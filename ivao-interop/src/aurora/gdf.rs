use std::collections::HashMap;
use std::str::Split;

use anyhow::anyhow;
use open_air::domain::viewer::Colour;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Statement {
    contents: String,
}

impl Statement {
    /// Construct a statement from a string.
    pub fn from_str(src: impl Into<String>) -> Statement {
        let mut contents = src.into();
        if contents.ends_with(";") {
            contents.pop();
        }

        Statement {
            contents,
        }
    }

    /// Get the string value of this statement.
    pub fn as_str(&self) -> &str {
        &self.contents
    }

    /// Iterate over the parts in this statement.
    pub fn parts(&self) -> Split<'_, char> {
        self.contents.split(';')
    }
}

#[derive(Debug, Clone, Default)]
pub struct Section {
    statements: Vec<Statement>,
}

impl Section {
    /// Fetch the list of statements contained in this section.
    pub fn statements(&self) -> &[Statement] {
        &self.statements
    }
}

#[derive(Debug, Clone, Default)]
pub struct File {
    sections: HashMap<String, Section>,
}

impl File {
    /// Create a new empty sector file.
    pub fn new() -> File {
        Default::default()
    }

    /// Return the sections map
    pub fn sections(&self) -> &HashMap<String, Section> {
        &self.sections
    }

    /// Get the section with the given key.
    pub fn section(&self, key: &str) -> Option<&Section> {
        self.sections.get(key)
    }

    /// Get or create a section with the given name.
    pub fn section_mut(&mut self, key: &str) -> &mut Section {
        if !self.sections.contains_key(key) {
            self.sections.insert(key.to_owned(), Default::default());
        }

        self.sections.get_mut(key).unwrap()
    }

    /// Parse a sector file from a string.
    pub fn parse(src: &str) -> anyhow::Result<File> {
        let mut sections = HashMap::new();
        let mut section: Option<(String, Section)> = None;

        let mut flush_section = |section: &mut Option<(String, Section)>| {
            if let Some((key, section)) = section.take() {
                sections.insert(key.to_owned(), section);
            }
        };

        let lines = src.lines()
            .map(|l| l.trim())
            .filter(|v| !v.is_empty() && !v.starts_with("//"));
        for line in lines {
            if line.starts_with("[") {
                // New section
                if !line.ends_with("]") {
                    Err(anyhow!("section must end with ], got: {}", line))?;
                }

                flush_section(&mut section);
                let section_name = &line[1..line.len() - 1];
                section = Some((section_name.to_owned(), Default::default()));
            } else if let Some((_, ref mut section)) = section {
                // Statement
                section.statements.push(Statement::from_str(line));
            } else {
                let mut new_section = Section::default();
                new_section.statements.push(Statement::from_str(line));
                section = Some((String::new(), new_section));
            }
        }

        flush_section(&mut section);
        Ok(File {
            sections,
        })
    }
}

fn parse_long_or_lat(src: &str, pos: char, neg: char) -> anyhow::Result<f64> {
    let is_decimal = match src.chars().next() {
        Some('-') => true,
        Some(x) => x.is_digit(10),
        None => false,
    };

    if is_decimal {
        Ok(src.parse()?)
    } else {
        let mut chars = src.chars();
        let multiplier = match chars.next() {
            Some(x) if x == pos => 1.0f64,
            Some(x) if x == neg => -1.0f64,
            Some(x) => return Err(anyhow!("unexpected prefix {}", x)),
            None => return Err(anyhow!("missing prefix character")),
        };

        let (degrees, minutes, seconds) = if src.contains('.') {
            let mut parts = chars.as_str().splitn(3, '.');

            let degrees: f64 = parts.next()
                .ok_or_else(|| anyhow!("missing degrees"))
                .and_then(|v| Ok(str::parse(v)?))?;
            let minutes: f64 = parts.next()
                .ok_or_else(|| anyhow!("missing minutes"))
                .and_then(|v| Ok(str::parse(v)?))?;
            let seconds: f64 = parts.next()
                .ok_or_else(|| anyhow!("missing seconds"))
                .and_then(|v| Ok(str::parse(v)?))?;

            if let Some(part) = parts.next() {
                Err(anyhow!("unexpected characters: {}", part))?;
            }

            (degrees, minutes, seconds)
        } else if src.len() == 11 {
            let degrees: f64 = src[1..4].parse()?;
            let minutes: f64 = src[4..6].parse()?;
            let seconds = src[6..].parse::<f64>()? / 1000.;
            (degrees, minutes, seconds)
        } else {
            return Err(anyhow!("unsupported coordinate format: {}", src));
        };

        Ok((degrees + (minutes / 60f64) + (seconds / 3600f64)) * multiplier)
    }
}

pub fn parse_latitude(src: &str) -> anyhow::Result<f64> {
    parse_long_or_lat(src, 'N', 'S')
}

pub fn parse_longitude(src: &str) -> anyhow::Result<f64> {
    parse_long_or_lat(src, 'E', 'W')
}

pub fn parse_colour(src: &str) -> anyhow::Result<Colour> {
    let mut chars = src.chars();
    match chars.next() {
        Some('#' | '$') => Ok(Colour::Value(src[1..].parse::<u32>()?)),
        Some('%') => {
            let mut parts = src[1..].splitn(3,':');
            let r = parts.next()
                .ok_or_else(|| anyhow!("missing red component"))?
                .parse::<u32>()?;
            let g = parts.next()
                .ok_or_else(|| anyhow!("missing green component"))?
                .parse::<u32>()?;
            let b = parts.next()
                .ok_or_else(|| anyhow!("missing blue component"))?
                .parse::<u32>()?;
            Ok(Colour::Value((r << 16) | (g << 8) | b))
        },
        Some(_) => Ok(Colour::Reference(src.to_owned())),
        None => Err(anyhow!("unexpected character parsing colour")),
    }
}

#[cfg(test)]
mod test {
    use crate::aurora::gdf::Statement;

    use super::File;

    #[test]
    fn test_parse() {
        const SOURCE: &str = "
            // Test
            [MY_SECTION]
            My;Statement;1  ;
            My;Statement;2

            // Comment
            [SECTION_2]
        ";

        let file = File::parse(SOURCE).unwrap();
        assert_eq!(file.sections().len(), 2);

        let section = file.section("MY_SECTION").unwrap();
        let stmts = section.statements();
        assert_eq!(stmts.len(), 2);
        assert_eq!(stmts[0], Statement::from_str("My;Statement;1  "));
        assert_eq!(stmts[0].parts().nth(2), Some("1  "));
    }
}
