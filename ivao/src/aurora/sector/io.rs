use std::collections::HashMap;
use std::path::PathBuf;

use anyhow::anyhow;
use relative_path::RelativePath;
use walkdir::WalkDir;

pub trait FileSource {
    fn read_file(&mut self, path: &str) -> anyhow::Result<Option<Vec<u8>>>;
}

#[derive(Debug, Clone)]
pub struct DirectorySource {
    paths: HashMap<String, PathBuf>,
}

impl DirectorySource {
    pub fn new(base_path: PathBuf) -> anyhow::Result<DirectorySource> {
        let base_path = base_path.canonicalize()?;
        let mut paths = HashMap::new();

        for entry in WalkDir::new(&base_path)
            .follow_links(true)
            .into_iter() {
            let entry = entry?;
            if !entry.file_type().is_file() {
                continue;
            }

            let relative = pathdiff::diff_paths(entry.path(), &base_path)
                .ok_or_else(|| anyhow!("somehow found a file not contained in the input path"))?;

            let path = RelativePath::from_path(&relative)?;
            let lower_path = path.as_str().to_lowercase();

            paths.insert(lower_path, entry.path().to_owned());
        }

        Ok(DirectorySource {
            paths,
        })
    }
}

impl FileSource for DirectorySource {
    fn read_file(&mut self, path: &str) -> anyhow::Result<Option<Vec<u8>>> {
        let path = path.to_lowercase();

        if let Some(path) = self.paths.get(&path) {
            Ok(Some(std::fs::read(path)?))
        } else {
            Ok(None)
        }
    }
}

impl FileSource for HashMap<String, Vec<u8>> {
    fn read_file(&mut self, path: &str) -> anyhow::Result<Option<Vec<u8>>> {
        Ok(self.get(path).cloned())
    }
}
