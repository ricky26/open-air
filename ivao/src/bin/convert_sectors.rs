use clap::Clap;
use std::path::PathBuf;
use ivao::aurora::sector::{DirectorySource, Sector};
use open_air::domain::viewer::SectionBuilder;

#[derive(Clap)]
struct Opts {
    #[clap(short, long)]
    input: PathBuf,

    #[clap(short, long)]
    output: PathBuf,

    sector_files: Vec<String>,
}

fn main() -> anyhow::Result<()> {
    env_logger::init();

    let opts = Opts::parse();
    let mut source = DirectorySource::new(opts.input.clone())?;
    let mut builder = SectionBuilder::new(9);

    for path in opts.sector_files {
        let sector = Sector::parse(&mut source, &path)?;
        sector.convert(&mut builder)?;
    }

    let (global, sections) = builder.build();
    for section in sections {
        let name = format!("section_{:03}_{:03}_{:03}.json", section.division.0, section.division.1, section.division.2);
        let contents = serde_json::to_string_pretty(&section)?;
        let abs_path = opts.output.join(name);
        std::fs::write(&abs_path, &contents)?;
    }

    let abs_path = opts.output.join("global.json");
    let contents = serde_json::to_string_pretty(&global)?;
    std::fs::write(&abs_path, &contents)?;

    Ok(())
}
