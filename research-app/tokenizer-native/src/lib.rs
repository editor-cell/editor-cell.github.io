use jni::objects::{JClass, JString};
use jni::sys::{jlong, jobjectArray};
use jni::JNIEnv;
use tokenizers::{Tokenizer, TruncationParams, TruncationStrategy};

fn fail(env: &mut JNIEnv, message: impl ToString) {
    let _ = env.throw_new("java/lang/IllegalStateException", message.to_string());
}

#[no_mangle]
pub extern "system" fn Java_com_orbis_research_NativeTokenizer_open(
    mut env: JNIEnv, _class: JClass, path: JString,
) -> jlong {
    let result = (|| -> Result<Tokenizer, String> {
        let path: String = env.get_string(&path).map_err(|e| e.to_string())?.into();
        let mut tokenizer = Tokenizer::from_file(path).map_err(|e| e.to_string())?;
        tokenizer.with_padding(None);
        tokenizer.with_truncation(Some(TruncationParams {
            max_length: 1024, strategy: TruncationStrategy::OnlyFirst, ..Default::default()
        })).map_err(|e| e.to_string())?;
        Ok(tokenizer)
    })();
    match result {
        Ok(tokenizer) => Box::into_raw(Box::new(tokenizer)) as jlong,
        Err(error) => { fail(&mut env, error); 0 }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_orbis_research_NativeTokenizer_encode(
    mut env: JNIEnv, _class: JClass, handle: jlong, paragraph: JString, claim: JString,
) -> jobjectArray {
    if handle == 0 { fail(&mut env, "Tokenizer is closed"); return std::ptr::null_mut(); }
    let result = (|| -> Result<jobjectArray, String> {
        let p: String = env.get_string(&paragraph).map_err(|e| e.to_string())?.into();
        let h: String = env.get_string(&claim).map_err(|e| e.to_string())?.into();
        let tokenizer = unsafe { &*(handle as *const Tokenizer) };
        let encoding = tokenizer.encode((p.as_str(), h.as_str()), true).map_err(|e| e.to_string())?;
        let array = env.new_object_array(3, "[J", jni::objects::JObject::null()).map_err(|e| e.to_string())?;
        for (index, values) in [encoding.get_ids(), encoding.get_attention_mask(), encoding.get_type_ids()].iter().enumerate() {
            let values: Vec<i64> = values.iter().map(|&v| v as i64).collect();
            let item = env.new_long_array(values.len() as i32).map_err(|e| e.to_string())?;
            env.set_long_array_region(&item, 0, &values).map_err(|e| e.to_string())?;
            env.set_object_array_element(&array, index as i32, &item).map_err(|e| e.to_string())?;
        }
        Ok(array.into_raw())
    })();
    match result {
        Ok(array) => array,
        Err(error) => { fail(&mut env, error); std::ptr::null_mut() }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_orbis_research_NativeTokenizer_close(
    _env: JNIEnv, _class: JClass, handle: jlong,
) {
    if handle != 0 { unsafe { drop(Box::from_raw(handle as *mut Tokenizer)); } }
}
