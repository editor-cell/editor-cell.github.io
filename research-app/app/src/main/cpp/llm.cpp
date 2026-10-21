// A thin JNI bridge to llama.cpp: load a GGUF model and either run one prompt at a time
// (the language model) or turn a text into a vector of its meaning (the embedding model).

#include <jni.h>
#ifdef __ANDROID__
#include <android/log.h>
#else
#include <cstdio>
#define ANDROID_LOG_INFO 4
#define ANDROID_LOG_WARN 5
#define ANDROID_LOG_ERROR 6
#define __android_log_print(level, tag, ...) (fprintf(stderr, __VA_ARGS__), fputc('\n', stderr))
#endif
#include <unistd.h>

#include <algorithm>
#include <atomic>
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
    // Tokens now held in the model's memory. A new prompt that starts the same way (same
    // instructions, same claim) only has its new part read, which matters on a slow phone.
    std::vector<llama_token> cached;
    // Set from another thread to stop the current call. It is checked between steps, never
    // inside one: stopping llama.cpp in the middle of a step (its abort callback) corrupted
    // memory in our tests with the 4B model.
    std::atomic<bool> abort{false};
};

// The prompt is read this many tokens at a time, so a stop waits for one small step at most.
static const int STEP = 32;

static int phone_threads() {
    const int cores = (int) sysconf(_SC_NPROCESSORS_ONLN);
    return std::max(2, std::min(4, cores - 2));
}

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
Java_com_orbis_research_LlmNative_nativeInit(JNIEnv * env, jobject, jstring libDir) {
    llama_log_set(log_cb, nullptr);
    std::string dir = jstr(env, libDir);
    ggml_backend_load_all_from_path(dir.c_str());
    llama_backend_init();
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_orbis_research_LlmNative_nativeLoad(JNIEnv * env, jobject, jstring path, jint nCtx) {
    std::string p = jstr(env, path);
    llama_model_params mp = llama_model_default_params();
    llama_model * model = llama_model_load_from_file(p.c_str(), mp);
    if (!model) { LOGE("model load failed: %s", p.c_str()); return 0; }

    const int threads = phone_threads();
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

// Stops the call running on [handle] after its current small step; safe from any thread.
extern "C" JNIEXPORT void JNICALL
Java_com_orbis_research_LlmNative_nativeAbort(JNIEnv *, jobject, jlong handle) {
    auto * e = (Engine *) handle;
    if (e) e->abort = true;
}

extern "C" JNIEXPORT void JNICALL
Java_com_orbis_research_LlmNative_nativeFree(JNIEnv *, jobject, jlong handle) {
    auto * e = (Engine *) handle;
    if (!e) return;
    llama_free(e->ctx);
    llama_model_free(e->model);
    delete e;
}

// Runs system + user messages through the model's chat template, appends [prefix] as the start
// of the model's answer, and generates at most maxTokens tokens, greedily. A non-empty grammar
// (GBNF) restricts what can be produced.
extern "C" JNIEXPORT jstring JNICALL
Java_com_orbis_research_LlmNative_nativeGenerate(JNIEnv * env, jobject, jlong handle, jstring jsys,
                                           jstring juser, jstring jgrammar, jstring jprefix, jint maxTokens) {
    auto * e = (Engine *) handle;
    if (!e) return nullptr;
    e->abort = false;
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
    prompt += jstr(env, jprefix);

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

    llama_memory_t mem = llama_get_memory(e->ctx);
    size_t common = 0;
    while (common < e->cached.size() && common < toks.size() && e->cached[common] == toks[common]) common++;
    if (common == toks.size()) common--;  // the last prompt token must be read again to answer
    if (common == 0 || !llama_memory_seq_rm(mem, 0, (llama_pos) common, -1)) {
        llama_memory_clear(mem, true);
        common = 0;
    }
    e->cached.assign(toks.begin(), toks.begin() + common);

    llama_sampler * smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    if (!grammar.empty()) {
        llama_sampler * g = llama_sampler_init_grammar(e->vocab, grammar.c_str(), "root");
        if (!g) { llama_sampler_free(smpl); LOGE("bad grammar"); return nullptr; }
        llama_sampler_chain_add(smpl, g);
    }
    llama_sampler_chain_add(smpl, llama_sampler_init_greedy());

    // Feed the prompt in small pieces, looking for a stop between them.
    for (int i = (int) common; i < nt; i += STEP) {
        int len = std::min(STEP, nt - i);
        if (e->abort || llama_decode(e->ctx, llama_batch_get_one(toks.data() + i, len)) != 0) {
            llama_sampler_free(smpl);
            llama_memory_clear(mem, true);
            e->cached.clear();
            if (!e->abort) LOGE("decode failed");
            return nullptr;
        }
        e->cached.insert(e->cached.end(), toks.begin() + i, toks.begin() + i + len);
    }

    std::string out;
    char piece[256];
    for (int i = 0; i < maxTokens && !e->abort; i++) {
        llama_token tok = llama_sampler_sample(smpl, e->ctx, -1);
        if (llama_vocab_is_eog(e->vocab, tok)) break;
        int len = llama_token_to_piece(e->vocab, tok, piece, sizeof(piece), 0, false);
        if (len > 0) out.append(piece, len);
        if (llama_decode(e->ctx, llama_batch_get_one(&tok, 1)) != 0) {
            llama_memory_clear(mem, true);
            e->cached.clear();
            break;
        }
        e->cached.push_back(tok);
    }
    llama_sampler_free(smpl);
    if (e->abort) return nullptr;
    return to_jstring(env, out);
}

// ---- meaning vectors ----

extern "C" JNIEXPORT jlong JNICALL
Java_com_orbis_research_LlmNative_nativeLoadEmbedder(JNIEnv * env, jobject, jstring path, jint nCtx) {
    std::string p = jstr(env, path);
    llama_model * model = llama_model_load_from_file(p.c_str(), llama_model_default_params());
    if (!model) { LOGE("embedding model load failed: %s", p.c_str()); return 0; }
    const int threads = phone_threads();
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = (uint32_t) nCtx;
    cp.n_batch = (uint32_t) nCtx;   // a text is read in one piece: these models look both ways
    cp.n_ubatch = (uint32_t) nCtx;
    cp.n_threads = threads;
    cp.n_threads_batch = threads;
    cp.embeddings = true;
    llama_context * ctx = llama_init_from_model(model, cp);
    if (!ctx) { llama_model_free(model); LOGE("embedding context init failed"); return 0; }
    auto * e = new Engine();
    e->model = model;
    e->ctx = ctx;
    e->vocab = llama_model_get_vocab(model);
    LOGI("embedding model loaded, %d threads, %d dims", threads, llama_model_n_embd_out(model));
    return (jlong) e;
}

// The meaning of [text] as a vector (not yet normalised); null if it could not be read.
extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_orbis_research_LlmNative_nativeEmbed(JNIEnv * env, jobject, jlong handle, jstring jtext) {
    auto * e = (Engine *) handle;
    if (!e) return nullptr;
    e->abort = false;
    std::string text = jstr(env, jtext);
    const int n_ctx = (int) llama_n_ctx(e->ctx);
    std::vector<llama_token> toks(text.size() + 16);
    int nt = llama_tokenize(e->vocab, text.c_str(), (int32_t) text.size(), toks.data(), (int32_t) toks.size(), true, false);
    if (nt < 0) {
        toks.resize(-nt);
        nt = llama_tokenize(e->vocab, text.c_str(), (int32_t) text.size(), toks.data(), (int32_t) toks.size(), true, false);
    }
    if (nt <= 0) return nullptr;
    if (nt > n_ctx) {
        // Keep the beginning, and the end-of-text marker some models pool on.
        llama_token last = toks[nt - 1];
        nt = n_ctx;
        if (llama_vocab_get_add_eos(e->vocab)) toks[nt - 1] = last;
    }
    llama_batch batch = llama_batch_init(nt, 0, 1);
    for (int i = 0; i < nt; i++) {
        batch.token[i] = toks[i];
        batch.pos[i] = i;
        batch.n_seq_id[i] = 1;
        batch.seq_id[i][0] = 0;
        batch.logits[i] = true;
    }
    batch.n_tokens = nt;
    llama_memory_clear(llama_get_memory(e->ctx), true);
    const llama_model * m = e->model;
    int rc = (llama_model_has_encoder(m) && !llama_model_has_decoder(m)) ? llama_encode(e->ctx, batch) : llama_decode(e->ctx, batch);
    llama_batch_free(batch);
    if (rc != 0) { LOGE("embedding failed: %d", rc); return nullptr; }

    const int n = llama_model_n_embd_out(m);
    const float * v = llama_pooling_type(e->ctx) == LLAMA_POOLING_TYPE_NONE
        ? llama_get_embeddings_ith(e->ctx, nt - 1)
        : llama_get_embeddings_seq(e->ctx, 0);
    if (!v) return nullptr;
    jfloatArray out = env->NewFloatArray(n);
    env->SetFloatArrayRegion(out, 0, n, v);
    return out;
}
