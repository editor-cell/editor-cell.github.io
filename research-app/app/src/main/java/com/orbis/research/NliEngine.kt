package com.orbis.research

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.io.Closeable
import java.io.File

/** Runs the same tokenizer and classifier in Android and the host parity tests. */
class NliEngine(directory: File) : Closeable {
    private val env = OrtEnvironment.getEnvironment()
    private var tokenizer = NativeTokenizer.open(File(directory, "tokenizer.json").path)
    private val session: OrtSession
    @Volatile private var active: OrtSession.RunOptions? = null
    init {
        try {
            OrtSession.SessionOptions().use { options ->
                options.setIntraOpNumThreads(minOf(4, Runtime.getRuntime().availableProcessors()))
                options.setInterOpNumThreads(1)
                options.setMemoryPatternOptimization(false)
                options.setCPUArenaAllocator(false)
                options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
                session = env.createSession(File(directory, "model.onnx").path, options)
            }
        } catch (e: Throwable) { NativeTokenizer.close(tokenizer); tokenizer = 0; throw e }
    }

    @Synchronized fun logits(paragraph: String, claim: String): FloatArray {
        check(tokenizer != 0L) { "Model is closed" }
        val encoded = NativeTokenizer.encode(tokenizer, paragraph, claim)
        val arrays = mapOf("input_ids" to encoded[0], "attention_mask" to encoded[1], "token_type_ids" to encoded[2])
        val tensors = session.inputNames.associateWith { name ->
            OnnxTensor.createTensor(env, arrayOf(arrays[name] ?: error("Unsupported model input: $name")))
        }
        try {
            OrtSession.RunOptions().use { run ->
                active = run
                try {
                    session.run(tensors, run).use { result ->
                        @Suppress("UNCHECKED_CAST")
                        val value = result[0].value as Array<FloatArray>
                        return value[0].copyOf()
                    }
                } finally { active = null }
            }
        } finally { tensors.values.forEach { it.close() } }
    }

    fun abort() { try { active?.setTerminate(true) } catch (_: Exception) { } }

    @Synchronized override fun close() {
        if (tokenizer == 0L) return
        session.close()
        NativeTokenizer.close(tokenizer)
        tokenizer = 0
    }
}
