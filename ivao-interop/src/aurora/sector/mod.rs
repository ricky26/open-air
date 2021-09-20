use std::collections::{HashMap, VecDeque};
use std::iter::FromIterator;

use anyhow::anyhow;
use log::warn;
use relative_path::{RelativePath, RelativePathBuf};

use airport::Airport;
pub use io::{DirectorySource, FileSource};
use open_air::domain::coords::geo_to_map;
use open_air::domain::viewer::Colour;
use visual::Geo;

use crate::aurora::gdf::{parse_colour, Statement};
use crate::aurora::sector::airport::{Gate, Runway, Taxiway};
use crate::aurora::sector::fixes::{Fix, NDB, VOR};
use crate::aurora::sector::visual::FillColor;

use super::gdf::{File, parse_latitude, parse_longitude, Section};

mod io;
mod parsing;
mod visual;
mod convert;
mod airport;
mod fixes;

const INCLUDE_PATH: &str = "Include";

fn load_file_contents(fs: &mut impl FileSource, include_dirs: &[String], name: &str) -> anyhow::Result<Option<Vec<u8>>> {
    let name = RelativePathBuf::from(name.replace('\\', "/"));
    let name = name.normalize();

    let test_path = RelativePath::new(INCLUDE_PATH).join(&name).normalize();
    if let Some(contents) = fs.read_file(test_path.as_str())? {
        return Ok(Some(contents));
    }

    for dir in include_dirs.iter() {
        let test_path = RelativePath::new(INCLUDE_PATH).join(dir).join(&name).normalize();
        if let Some(contents) = fs.read_file(test_path.as_str())? {
            return Ok(Some(contents));
        }
    }

    Ok(None)
}

fn load_file(fs: &mut impl FileSource, include_dirs: &[String], name: &str) -> anyhow::Result<Option<File>> {
    Ok(load_file_contents(fs, include_dirs, name)?
        .map(String::from_utf8)
        .transpose()?
        .map(|s| File::parse(&s))
        .transpose()?)
}

fn warn_filter<T>(result: anyhow::Result<T>) -> Option<T> {
    match result {
        Ok(v) => Some(v),
        Err(err) => {
            warn!("badly formatted input: {}", err);
            None
        }
    }
}

struct SectionStatementIter<'a, S> {
    fs: &'a mut S,
    include_dirs: Vec<String>,
    statements: VecDeque<Statement>,
}

impl<'a, S: FileSource> SectionStatementIter<'a, S> {
    pub fn new(fs: &'a mut S, include_dirs: &[String], statements: &[Statement]) -> SectionStatementIter<'a, S> {
        SectionStatementIter {
            fs,
            include_dirs: include_dirs.to_vec(),
            statements: VecDeque::from_iter(statements.iter().cloned()),
        }
    }

    pub fn from_section(fs: &'a mut S, include_dirs: &[String], section: Option<&Section>) -> SectionStatementIter<'a, S> {
        Self::new(fs, include_dirs, section.as_ref().map_or(&[], |s| s.statements()))
    }

    fn load_file(&mut self, name: Option<&str>) -> anyhow::Result<()> {
        let name = name.ok_or_else(|| anyhow!("missing filename"))?;
        let file = load_file(self.fs, &self.include_dirs, name)?
            .ok_or_else(|| anyhow!("missing referenced file: {}", name))?;

        if file.sections().len() != 1 {
            Err(anyhow!("unexpected sections in include: {}", name))?;
        }

        let section = match file.section("") {
            Some(x) => x,
            None => return Err(anyhow!("missing empty section")),
        };

        for statement in section.statements().iter().rev() {
            self.statements.push_front(statement.clone());
        }

        Ok(())
    }
}

impl<'a, S: FileSource> Iterator for SectionStatementIter<'a, S> {
    type Item = anyhow::Result<Statement>;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            let next = match self.statements.pop_front() {
                Some(x) => x,
                None => return None,
            };

            let mut parts = next.parts();
            if parts.next() == Some("F") {
                // Load a new file
                if let Err(x) = self.load_file(parts.next()) {
                    return Some(Err(x));
                }
            } else {
                break Some(Ok(next));
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct SectorInfo {
    pub center: (f64, f64),
    pub ratio: (f64, f64),
    pub magnetic_variance: f64,
    pub include_dirs: Vec<String>,
}

impl SectorInfo {
    pub fn from_section(section: &Section) -> anyhow::Result<SectorInfo> {
        let mut statements = section.statements().into_iter();

        let lat = statements.next()
            .ok_or_else(|| anyhow!("missing latitude"))
            .and_then(|s| Ok(parse_latitude(s.as_str())?))?;
        let long = statements.next()
            .ok_or_else(|| anyhow!("missing longitude"))
            .and_then(|s| Ok(parse_longitude(s.as_str())?))?;

        let vert_ratio: f64 = statements.next()
            .ok_or_else(|| anyhow!("missing vertical ratio"))
            .and_then(|s| Ok(s.as_str().parse()?))?;
        let horiz_ratio: f64 = statements.next()
            .ok_or_else(|| anyhow!("missing horizontal ratio"))
            .and_then(|s| Ok(s.as_str().parse()?))?;
        let magnetic_variance: f64 = statements.next()
            .ok_or_else(|| anyhow!("missing magnetic variation"))
            .and_then(|s| Ok(s.as_str().parse()?))?;

        let include_dirs = statements.next()
            .map_or(Vec::new(), |s| {
                s.parts().map(|p| p.replace('\\', "/")).collect()
            });
        Ok(SectorInfo {
            center: (lat, long),
            ratio: (vert_ratio, horiz_ratio),
            magnetic_variance,
            include_dirs,
        })
    }
}

#[derive(Debug, Clone)]
pub struct Sector {
    pub info: SectorInfo,

    pub airports: Vec<Airport>,
    pub runways: Vec<Runway>,
    pub taxiways: Vec<Taxiway>,
    pub gates: Vec<Gate>,

    pub fixes: Vec<Fix>,
    pub ndbs: Vec<NDB>,
    pub vors: Vec<VOR>,

    pub defines: HashMap<String, Colour>,
    pub geo: Vec<Geo>,
    pub fill_colors: Vec<FillColor>,
}

impl Sector {
    pub fn parse(fs: &mut impl FileSource, name: &str) -> anyhow::Result<Sector> {
        let root_file = File::parse(&String::from_utf8(fs.read_file(name)?
            .ok_or_else(|| anyhow!("missing section main file"))?)?)?;

        let info = root_file.section("INFO").ok_or(anyhow!("missing INFO section"))?;
        let info = SectorInfo::from_section(info)?;

        let mut defines = HashMap::new();
        for statement in SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("DEFINE")) {
            let statement = statement?;
            let mut parts = statement.parts();
            let name = parts.next()
                .ok_or_else(|| anyhow!("missing define name"))?
                .to_owned();
            let fill_color = parse_colour(parts.next()
                .ok_or_else(|| anyhow!("missing colour"))?)?;
            defines.insert(name, fill_color);
        }

        let airports = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("AIRPORT"))
            .filter_map(warn_filter)
            .map(|s| Airport::parse(&s))
            .filter_map(warn_filter)
            .collect::<Vec<_>>();

        let runways = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("RUNWAY"))
            .filter_map(warn_filter)
            .map(|s| Runway::parse(&s))
            .filter_map(warn_filter)
            .collect();

        let mut taxiways = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("TAXIWAY"))
            .filter_map(warn_filter)
            .map(|s| Taxiway::parse(&s))
            .filter_map(warn_filter)
            .collect::<Vec<_>>();

        let mut gates = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("GATES"))
            .filter_map(warn_filter)
            .map(|s| Gate::parse(&s))
            .filter_map(warn_filter)
            .collect::<Vec<_>>();

        let fixes = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("FIXES"))
            .filter_map(warn_filter)
            .map(|s| Fix::parse(&s))
            .filter_map(warn_filter)
            .collect();

        let ndbs = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("NDB"))
            .filter_map(warn_filter)
            .map(|s| NDB::parse(&s))
            .filter_map(warn_filter)
            .collect();

        let vors = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("VOR"))
            .filter_map(warn_filter)
            .map(|s| VOR::parse(&s))
            .filter_map(warn_filter)
            .collect();

        let geo = SectionStatementIter::from_section(
            fs, &info.include_dirs, root_file.section("GEO"))
            .filter_map(warn_filter)
            .map(|s| Geo::parse(&s))
            .filter_map(warn_filter)
            .collect();

        let mut fill_colors = Vec::new();
        FillColor::from_iterator(
            &mut fill_colors,
            SectionStatementIter::from_section(fs, &info.include_dirs, root_file.section("FILLCOLOR")))?;

        for airport in airports.iter() {
            let fill_color_name = format!("{}.tfl", &airport.identifier);
            if let Some(file) = load_file(fs, &info.include_dirs, &fill_color_name)? {
                if let Some(section) = file.section("") {
                    FillColor::from_iterator(
                        &mut fill_colors,
                        section.statements().iter().cloned().map(Ok))?;
                }
            }

            if let Some(file) = load_file(
                fs, &info.include_dirs, &format!("{}.txi", &airport.identifier))? {
                if let Some(section) = file.section("") {
                    for statement in section.statements().iter() {
                        if let Some(taxiway) = warn_filter(Taxiway::parse(statement)) {
                            taxiways.push(taxiway);
                        }
                    }
                }
            }

            if let Some(file) = load_file(
                fs, &info.include_dirs, &format!("{}.gts", &airport.identifier))? {
                if let Some(section) = file.section("") {
                    for statement in section.statements().iter() {
                        if let Some(gate) = warn_filter(Gate::parse(statement)) {
                            gates.push(gate);
                        }
                    }
                }
            }
        }

        Ok(Sector {
            info,

            airports,
            runways,
            taxiways,
            gates,

            fixes,
            ndbs,
            vors,

            defines,
            geo,
            fill_colors,
        })
    }

    fn lookup_longitude(&self, name: &str) -> anyhow::Result<f64> {
        parse_longitude(name)
    }

    fn lookup_latitude(&self, name: &str) -> anyhow::Result<f64> {
        parse_latitude(name)
    }

    pub fn lookup_geo_position(&self, latitude: &str, longitude: &str) -> anyhow::Result<(f64, f64)> {
        Ok((self.lookup_latitude(latitude)?, self.lookup_longitude(longitude)?))
    }

    pub fn lookup_map_position(&self, latitude: &str, longitude: &str) -> anyhow::Result<(f64, f64)> {
        let (latitude, longitude) = self.lookup_geo_position(latitude, longitude)?;
        Ok(geo_to_map(latitude, longitude))
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use approx::assert_abs_diff_eq;

    use super::*;

    #[test]
    fn test_parse() {
        let mut fs: HashMap<String, Vec<u8>> = HashMap::new();
        fs.insert("Sector.isc".into(), "
            [INFO]
            N60.02.03.005
            E0231256000
            25
            25
            0
            NAME

            [VOR]
        ".into());

        let sector = Sector::parse(&mut fs, "Sector.isc").unwrap();
        assert_abs_diff_eq!(sector.info.center.0, 23.215555, epsilon = 1e-6);
        assert_abs_diff_eq!(sector.info.center.1, 60.034168, epsilon = 1e-6);
    }
}
