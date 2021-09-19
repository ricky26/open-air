use std::collections::HashMap;
use std::path::PathBuf;

pub trait FileSource {
    fn read_file(&mut self, path: &str) -> anyhow::Result<Option<Vec<u8>>>;
}

#[derive(Debug, Clone)]
pub struct DirectorySource {
    base_path: PathBuf,
}

impl DirectorySource {
    pub fn new(base_path: PathBuf) -> DirectorySource {
        DirectorySource {
            base_path,
        }
    }
}

impl FileSource for DirectorySource {
    fn read_file(&mut self, path: &str) -> anyhow::Result<Option<Vec<u8>>> {
        let file_path = self.base_path.join(path);
        match std::fs::read(file_path) {
            Ok(v) => Ok(Some(v)),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(err) => Err(err.into()),
        }
    }
}

impl FileSource for HashMap<String, Vec<u8>> {
    fn read_file(&mut self, path: &str) -> anyhow::Result<Option<Vec<u8>>> {
        Ok(self.get(path).cloned())
    }
}
