use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct NowPlayingInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
}

#[cfg(target_os = "windows")]
pub fn get_now_playing() -> Option<NowPlayingInfo> {
    use futures::executor::block_on;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };

    block_on(async {
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .ok()?
            .await
            .ok()?;
        let session = manager.GetCurrentSession().ok()?;
        let playback = session.GetPlaybackInfo().ok()?;
        let status = playback.PlaybackStatus().ok()?;
        if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed {
            return None;
        }
        let props = session.TryGetMediaPropertiesAsync().ok()?.await.ok()?;
        let title = props.Title().ok()?.to_string();
        if title.is_empty() {
            return None;
        }
        Some(NowPlayingInfo {
            title,
            artist: props.Artist().ok()?.to_string(),
            album: props.AlbumTitle().ok()?.to_string(),
        })
    })
}

#[cfg(not(target_os = "windows"))]
pub fn get_now_playing() -> Option<NowPlayingInfo> {
    None
}
