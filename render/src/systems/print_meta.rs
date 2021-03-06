use kurbo::Vec2;
use specs::{Entities, Join, System, WriteStorage};
use staff::components::Song;
use stencil::components::{Parent, Stencil};

#[derive(Debug, Default)]
pub struct PrintMeta;

impl<'a> System<'a> for PrintMeta {
    type SystemData = (
        Entities<'a>,
        WriteStorage<'a, Parent>,
        WriteStorage<'a, Song>,
        WriteStorage<'a, Stencil>,
    );

    fn run(&mut self, (entities, mut parents, mut songs, mut stencils): Self::SystemData) {
        for (song_id, song) in (&entities, &mut songs).join() {
            if song.title_stencil.is_none() {
                let id = entities.create();
                song.title_stencil = Some(id);
                parents.insert(id, Parent(song_id)).unwrap();
            }

            // TODO: rastral size.
            let title_x = (song.width / 2f64 - song.title_width / 2f64) * 1000f64 / 7f64;
            stencils
                .insert(
                    song.title_stencil.unwrap(),
                    // TODO: sync with reconciler.ts.
                    Stencil::text(
                        &song.title,
                        7f64 * 1000f64 / 7f64,
                        song.title_width * 1000f64 / 7f64,
                    )
                    .with_translation(Vec2::new(title_x, 2500f64)),
                )
                .unwrap();

            if song.author_stencil.is_none() {
                let id = entities.create();
                song.author_stencil = Some(id);
                parents.insert(id, Parent(song_id)).unwrap();
            }

            // TODO: rastral size.
            // TODO: margin size
            let author_x = (song.width - song.author_width) * 1000f64 / 7f64 - 2500f64;
            stencils
                .insert(
                    song.author_stencil.unwrap(),
                    // TODO: sync with reconciler.ts.
                    Stencil::text(
                        &song.author,
                        5f64 * 1000f64 / 7f64,
                        song.author_width * 1000f64 / 7f64,
                    )
                    .with_translation(Vec2::new(author_x, 3500f64)),
                )
                .unwrap();
        }
    }
}
