use kurbo::Rect;
use specs::{Component, VecStorage};

#[derive(Debug, Default)]
pub struct WorldBbox(pub Rect);

impl Component for WorldBbox {
    type Storage = VecStorage<Self>;
}
