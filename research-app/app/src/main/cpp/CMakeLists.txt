cmake_minimum_required(VERSION 3.22.1)
project("orbisllm" LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED true)

# llama.cpp source, fetched by the build workflow at a fixed commit (see llama.cpp.version).
set(LLAMA_SRC ${CMAKE_CURRENT_LIST_DIR}/llama.cpp)
if(NOT EXISTS ${LLAMA_SRC}/CMakeLists.txt)
    message(FATAL_ERROR "llama.cpp source missing at ${LLAMA_SRC}; run research-app/fetch-llama.sh")
endif()

if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(GGML_SYSTEM_ARCH "ARM")
    set(GGML_CPU_KLEIDIAI ON)
    set(GGML_OPENMP ON)
endif()

add_subdirectory(${LLAMA_SRC} build-llama)

add_library(orbisllm SHARED llm.cpp)
target_include_directories(orbisllm PRIVATE ${LLAMA_SRC}/include ${LLAMA_SRC}/ggml/include)
target_link_libraries(orbisllm llama ggml android log)
