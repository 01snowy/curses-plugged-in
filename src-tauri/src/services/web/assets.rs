use std::sync::Arc;

use tauri::{http::header::*, AssetResolver, Runtime};
use warp::http::{HeaderValue, Response, StatusCode};
use warp::{filters::BoxedFilter, path::FullPath, Reply};
use warp::{Filter, Rejection};

const DEV_VITE: &str = "http://127.0.0.1:1420";

pub fn path<R: Runtime>(resolver: Arc<AssetResolver<R>>) -> BoxedFilter<(impl Reply,)> {
    warp::path::full()
        .and_then(move |path: FullPath| file_response(path, resolver.clone()))
        .boxed()
}

async fn fetch_dev_asset(path: &str) -> Option<(Vec<u8>, String)> {
    let path = path.trim_start_matches('/');
    let url = if path.is_empty() {
        format!("{DEV_VITE}/")
    } else {
        format!("{DEV_VITE}/{path}")
    };
    let response = reqwest::get(&url).await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response.bytes().await.ok()?.to_vec();
    Some((bytes, mime))
}

async fn file_response<R: Runtime>(
    path: FullPath,
    resolver: Arc<AssetResolver<R>>,
) -> Result<impl Reply, Rejection> {
    let path_str = path.as_str();

    if let Some(asset) = resolver.get(path_str.to_string()) {
        return Ok(asset_response(
            asset.bytes.to_vec(),
            asset.mime_type.as_str(),
        ));
    }

    #[cfg(debug_assertions)]
    if let Some((bytes, mime)) = fetch_dev_asset(path_str).await {
        return Ok(asset_response(bytes, &mime));
    }

    if let Some(index_asset) = resolver.get("/index.html".to_string()) {
        return Ok(asset_response(
            index_asset.bytes.to_vec(),
            index_asset.mime_type.as_str(),
        ));
    }

    #[cfg(debug_assertions)]
    if let Some((bytes, mime)) = fetch_dev_asset("index.html").await {
        return Ok(asset_response(bytes, &mime));
    }

    Err(warp::reject::not_found())
}

fn asset_response(bytes: Vec<u8>, mime_type: &str) -> Response<Vec<u8>> {
    let content_type = HeaderValue::from_str(mime_type)
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));
    Response::builder()
        .status(StatusCode::OK)
        .header(ACCEPT_RANGES, HeaderValue::from_static("bytes"))
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"))
        .header(CONTENT_TYPE, content_type)
        .header(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("frame-ancestors *"),
        )
        .header(X_FRAME_OPTIONS, HeaderValue::from_static("ALLOW-FROM *"))
        .body(bytes)
        .expect("valid response headers")
}
