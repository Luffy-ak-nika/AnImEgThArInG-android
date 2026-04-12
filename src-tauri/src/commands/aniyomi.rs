use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::io::Read;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AniyomiEntry {
    pub title: String,
    pub url: String,
    pub thumbnail: String,
    pub source: String,
}

#[derive(Debug, Deserialize)]
struct TachiyomiBackupManga {
    title: Option<String>,
    url: Option<String>,
    #[serde(rename = "thumbnailUrl")]
    thumbnail_url: Option<String>,
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TachiyomiBackup {
    #[serde(rename = "backupManga")]
    backup_manga: Option<Vec<TachiyomiBackupManga>>,
}

#[tauri::command]
pub fn import_aniyomi_backup(file_path: String) -> Result<Vec<AniyomiEntry>, String> {
    let path = std::path::Path::new(&file_path);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();

    if file_name.ends_with(".proto.gz") || extension == "gz" {
        // Handle .proto.gz - decompress gzip, attempt JSON parse
        parse_gz_backup(&file_path)
    } else if extension == "tachibk" || extension == "json" {
        // Handle .tachibk (actually a zip of json) or plain json
        parse_tachibk_backup(&file_path)
    } else {
        Err(format!(
            "Unsupported file format: {}. Expected .tachibk or .proto.gz",
            extension
        ))
    }
}

fn parse_gz_backup(file_path: &str) -> Result<Vec<AniyomiEntry>, String> {
    let file = std::fs::File::open(file_path).map_err(|e| format!("Cannot open file: {}", e))?;
    let mut decoder = GzDecoder::new(file);
    let mut decompressed = Vec::new();
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| format!("Failed to decompress gzip: {}", e))?;

    // First try parsing as JSON just in case
    if let Ok(json_str) = String::from_utf8(decompressed.clone()) {
        if let Ok(entries) = parse_json_backup(&json_str) {
            return Ok(entries);
        }
    }

    // Otherwise, parse as Protobuf binary
    Ok(extract_entries_from_proto(&decompressed))
}

fn parse_tachibk_backup(file_path: &str) -> Result<Vec<AniyomiEntry>, String> {
    let file = std::fs::File::open(file_path).map_err(|e| format!("Cannot open file: {}", e))?;

    // Try as zip first
    if let Ok(mut archive) = zip::ZipArchive::new(std::io::BufReader::new(&file)) {
        for i in 0..archive.len() {
            if let Ok(mut entry) = archive.by_index(i) {
                let name = entry.name().to_string();
                if name.ends_with(".json") || name == "backup.json" {
                    let mut contents = String::new();
                    if entry.read_to_string(&mut contents).is_ok() {
                        return parse_json_backup(&contents);
                    }
                }
            }
        }
    }

    // Try as Gzip Protobuf
    if let Ok(entries) = parse_gz_backup(file_path) {
        if !entries.is_empty() {
            return Ok(entries);
        }
    }

    // Try as plain JSON string
    let contents = std::fs::read_to_string(file_path).unwrap_or_default();
    parse_json_backup(&contents)
}

fn parse_json_backup(json_str: &str) -> Result<Vec<AniyomiEntry>, String> {
    let backup: TachiyomiBackup =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse JSON backup: {}", e))?;

    let entries: Vec<AniyomiEntry> = backup
        .backup_manga
        .unwrap_or_default()
        .into_iter()
        .filter_map(|manga| {
            let title = manga.title?;
            let url = manga.url.unwrap_or_default();
            if title.is_empty() {
                return None;
            }
            Some(AniyomiEntry {
                title,
                url,
                thumbnail: manga.thumbnail_url.unwrap_or_default(),
                source: manga.source.unwrap_or_else(|| "Unknown".to_string()),
            })
        })
        .collect();

    Ok(entries)
}

// ------ Micro Protobuf Parser for Aniyomi/Tachiyomi backpus ------

fn read_varint(data: &[u8], offset: &mut usize) -> Option<u64> {
    let mut result: u64 = 0;
    let mut shift = 0;
    while *offset < data.len() {
        let byte = data[*offset];
        *offset += 1;
        result |= ((byte & 0x7F) as u64) << shift;
        if byte & 0x80 == 0 {
            return Some(result);
        }
        shift += 7;
        if shift >= 64 { break; }
    }
    None
}

fn skip_field(wire_type: u8, data: &[u8], offset: &mut usize) -> bool {
    match wire_type {
        0 => read_varint(data, offset).is_some(),
        1 => {
            *offset += 8;
            *offset <= data.len()
        }
        2 => {
            if let Some(len) = read_varint(data, offset) {
                *offset += len as usize;
                *offset <= data.len()
            } else {
                false
            }
        }
        5 => {
            *offset += 4;
            *offset <= data.len()
        }
        _ => false,
    }
}

fn read_string(data: &[u8], offset: &mut usize) -> Option<String> {
    let len = read_varint(data, offset)? as usize;
    if *offset + len <= data.len() {
        let s = String::from_utf8_lossy(&data[*offset..*offset + len]).to_string();
        *offset += len;
        Some(s)
    } else {
        None
    }
}

fn extract_entries_from_proto(data: &[u8]) -> Vec<AniyomiEntry> {
    let mut entries = Vec::new();
    let mut offset = 0;

    while offset < data.len() {
        let old_offset = offset;
        if let Some(tag_type) = read_varint(data, &mut offset) {
            let wire_type = (tag_type & 0x07) as u8;
            let field_num = tag_type >> 3;

            // Aniyomi backupAnime = 101, backupManga = 1
            if wire_type == 2 && (field_num == 1 || field_num == 101) {
                if let Some(len) = read_varint(data, &mut offset) {
                    let end = offset + len as usize;
                    if end <= data.len() {
                        if let Some(entry) = parse_manga_message(&data[offset..end]) {
                            entries.push(entry);
                        }
                    }
                    offset = end.min(data.len());
                    continue;
                }
            } else {
                if !skip_field(wire_type, data, &mut offset) {
                    offset = old_offset + 1;
                }
            }
        } else {
            break;
        }
    }
    entries
}

fn parse_manga_message(data: &[u8]) -> Option<AniyomiEntry> {
    let mut title = String::new();
    let mut url = String::new();
    let mut thumbnail = String::new();
    let mut source_id = "Unknown".to_string();
    let mut offset = 0;

    while offset < data.len() {
        let old_offset = offset;
        if let Some(tag_type) = read_varint(data, &mut offset) {
            let wire_type = (tag_type & 0x07) as u8;
            let field_num = tag_type >> 3;

            if wire_type == 2 && field_num == 3 {
                title = read_string(data, &mut offset).unwrap_or_default();
            } else if wire_type == 2 && field_num == 2 {
                url = read_string(data, &mut offset).unwrap_or_default();
            } else if wire_type == 2 && field_num == 6 {
                thumbnail = read_string(data, &mut offset).unwrap_or_default();
            } else if wire_type == 0 && field_num == 1 {
                if let Some(src) = read_varint(data, &mut offset) {
                    source_id = src.to_string();
                }
            } else {
                if !skip_field(wire_type, data, &mut offset) {
                    offset = old_offset + 1;
                }
            }
        } else {
            break;
        }
    }

    if !title.is_empty() {
        Some(AniyomiEntry {
            title,
            url,
            thumbnail,
            source: source_id,
        })
    } else {
        None
    }
}
