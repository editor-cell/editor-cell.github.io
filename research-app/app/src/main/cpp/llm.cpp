// A thin JNI bridge to llama.cpp: load one GGUF model, run one prompt at a time.
// Every call starts from an empty context, so no answer leaks into the next.

#include <jni.h>
#include <android/log.h>
#include <unistd.h>

#include <algorithm>
#include <string>
#include <vector>

#include "llama.h"
#include "ggml-backend.h"

#define TAG "OrbisLlm"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

struct Engine {
    llama_model * model = nullptr;
    llama_context * ctx = nullptr;
    const llama_vocab * vocab = nullptr;
    std::string tmpl;
};

static void log_cb(ggml_log_level level, const char * text, void *) {
    if (level >= GGML_LOG_LEVEL_WARN) __android_log_print(ANDROID_LOG_WARN, TAG, "%s", text);
}

static std::string jstr(JNIEnv * env, jstring s) {
    if (!s) return {};
    const char * c = env->GetStringUTFChars(s, nullptr);
    std::string out(c);
    env->ReleaseStringUTFChars(s, c);
    return out;
}

// Java's NewStringUTF wants modified UTF-8; build the string from bytes instead so any
// token boundary inside a multi-byte character cannot crash the app.
static jstring to_jstring(JNIEnv * env, const std::string & s) {
    jbyteArray bytes = env->NewByteArray((jsize) s.size());
    env->SetByteArrayRegion(bytes, 0, (jsize) s.size(), (const jbyte *) s.data());
    jclass cls = env->FindClass("java/lang/String");
    jmethodID ctor = env->GetMethodID(cls, "<init>", "([BLjava/lang/String;)V");
    jstring enc = env->NewStringUTF("UTF-8");
    auto out = (jstring) env->NewObject(cls, ctor, bytes, enc);
    env->DeleteLocalRef(bytes);
    env->DeleteLocalRef(enc);
    env->DeleteLocalRef(cls);
    return out;
}

extern "C" JNIEXPORT void JNICALL
Java_com_orbis_research_Llm_nativeInit(JNIEnv * env, jobject, jstring libDir) {
    llama_log_set(log_cb, nullptr);
    std::string dir = jstr(env, libDir);
    ggml_backend_load_all_from_path(dir.c_str());
    llama_backend_init();
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_orbis_research_Llm_nativeLoad(JNIEnv * env, jobject, jstring path, jint nCtx) {
    std::string p = jstr(env, path);
    llama_model_params mp = llama_model_default_params();
    llama_model * model = llama_model_load_from_file(p.c_str(), mp);
    if (!model) { LOGE("model load failed: %s", p.c_str()); return 0; }

    const int cores = (int) sysconf(_SC_NPROCESSORS_ONLN);
    const int threads = std::max(2, std::min(4, cores - 2));
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = (uint32_t) nCtx;
    cp.n_batch = 512;
    cp.n_ubatch = 512;
    cp.n_threads = threads;
    cp.n_threads_batch = threads;
    llama_context * ctx = llama_init_from_model(model, cp);
    if (!ctx) { llama_model_free(model); LOGE("context init failed"); return 0; }

    auto * e = new Engine();
    e->model = model;
    e->ctx = ctx;
    e->vocab = llama_model_get_vocab(model);
    const char * t = llama_model_chat_template(model, nullptr);
    e->tmpl = t ? t : "chatml";
    LOGI("model loaded, %d threads", threads);
    return (jlong) e;
}

extern "C" JNIEXPORT void JNICALL
Java_com_orbis_research_Llm_nativeFree(JNIEnv *, jobject, jlong handle) {
    auto * e = (Engine *) handle;
    if (!e) return;
    llama_free(e->ctx);
    llama_model_free(e->model);
    delete e;
}

// Runs system + user messages through the model's chat template and generates at most
// maxTokens tokens, greedily. A non-empty grammar (GBNF) restricts what can be produced.
extern "C" JNIEXPORT jstring JNICALL
Java_com_orbis_research_Llm_nativeGenerate(JNIEnv * env, jobject, jlong handle, jstring jsys,
                                           jstring juser, jstring jgrammar, jint maxTokens) {
    auto * e = (Engine *) handle;
    if (!e) return nullptr;
    std::string sys = jstr(env, jsys), user = jstr(env, juser), grammar = jstr(env, jgrammar);

    llama_chat_message msgs[2] = {{"system", sys.c_str()}, {"user", user.c_str()}};
    std::vector<char> buf(2 * (sys.size() + user.size()) + 512);
    int n = llama_chat_apply_template(e->tmpl.c_str(), msgs, 2, true, buf.data(), (int32_t) buf.size());
    if (n < 0) {
        e->tmpl = "chatml";
        n = llama_chat_apply_template(e->tmpl.c_str(), msgs, 2, true, buf.data(), (int32_t) buf.size());
    }
    if (n > (int) buf.size()) {
        buf.resize(n + 1);
        n = llama_chat_apply_template(e->tmpl.c_str(), msgs, 2, true, buf.data(), (int32_t) buf.size());
    }
    if (n < 0) return nullptr;
    std::string prompt(buf.data(), n);

    const int n_ctx = (int) llama_n_ctx(e->ctx);
    std::vector<llama_token> toks(prompt.size() + 16);
    int nt = llama_tokenize(e->vocab, prompt.c_str(), (int32_t) prompt.size(), toks.data(),
                            (int32_t) toks.size(), true, true);
    if (nt < 0) {
        toks.resize(-nt);
        nt = llama_tokenize(e->vocab, prompt.c_str(), (int32_t) prompt.size(), toks.data(),
                            (int32_t) toks.size(), true, true);
    }
    if (nt <= 0 || nt + maxTokens >= n_ctx) { LOGE("prompt too long: %d tokens", nt); return nullptr; }
    toks.resize(nt);

    llama_memory_clear(llama_get_memory(e->ctx), true);

    llama_sampler * smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    if (!grammar.empty()) {
        llama_sampler * g = llama_sampler_init_grammar(e->vocab, grammar.c_str(), "root");
        if (!g) { llama_sampler_free(smpl); LOGE("bad grammar"); return nullptr; }
        llama_sampler_chain_add(smpl, g);
    }
    llama_sampler_chain_add(smpl, llama_sampler_init_greedy());

    // Feed the prompt in pieces no larger than the batch size.
    for (int i = 0; i < nt; i += 512) {
        int len = std::min(512, nt - i);
        if (llama_decode(e->ctx, llama_batch_get_one(toks.data() + i, len)) != 0) {
            llama_sampler_free(smpl);
            LOGE("decode failed");
            return nullptr;
        }
    }

    std::string out;
    char piece[256];
    for (int i = 0; i < maxTokens; i++) {
        llama_token tok = llama_sampler_sample(smpl, e->ctx, -1);
        if (llama_vocab_is_eog(e->vocab, tok)) break;
        int len = llama_token_to_piece(e->vocab, tok, piece, sizeof(piece), 0, false);
        if (len > 0) out.append(piece, len);
        if (llama_decode(e->ctx, llama_batch_get_one(&tok, 1)) != 0) break;
    }
    llama_sampler_free(smpl);
    return to_jstring(env, out);
}
