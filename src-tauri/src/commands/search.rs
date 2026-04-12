use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnimeSearchResult {
    pub mal_id: i64,
    pub title: String,
    pub title_english: Option<String>,
    pub image_url: String,
    pub score: Option<f64>,
    pub episodes: Option<i64>,
    pub status: String,
    pub synopsis: String,
}

#[derive(Debug, Deserialize)]
struct JikanResponse {
    data: Vec<JikanAnime>,
}

#[derive(Debug, Deserialize)]
struct JikanAnime {
    mal_id: i64,
    title: String,
    title_english: Option<String>,
    images: JikanImages,
    score: Option<f64>,
    episodes: Option<i64>,
    status: Option<String>,
    synopsis: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JikanImages {
    jpg: JikanImageFormat,
}

#[derive(Debug, Deserialize)]
struct JikanImageFormat {
    image_url: Option<String>,
    large_image_url: Option<String>,
}

#[tauri::command]
pub async fn search_anime(query: String) -> Result<Vec<AnimeSearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let url = format!(
        "https://api.jikan.moe/v4/anime?q={}&limit=20&sfw=false",
        urlencoding::encode(&query)
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Search request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Jikan API error: {}", response.status()));
    }

    let jikan: JikanResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse results: {}", e))?;

    let results: Vec<AnimeSearchResult> = jikan
        .data
        .into_iter()
        .map(|anime| AnimeSearchResult {
            mal_id: anime.mal_id,
            title: anime.title,
            title_english: anime.title_english,
            image_url: anime
                .images
                .jpg
                .large_image_url
                .or(anime.images.jpg.image_url)
                .unwrap_or_default(),
            score: anime.score,
            episodes: anime.episodes,
            status: anime.status.unwrap_or_else(|| "Unknown".to_string()),
            synopsis: anime
                .synopsis
                .map(|s| {
                    if s.len() > 200 {
                        format!("{}...", &s[..200])
                    } else {
                        s
                    }
                })
                .unwrap_or_default(),
        })
        .collect();

    Ok(results)
}
