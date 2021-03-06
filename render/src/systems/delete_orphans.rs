use std::collections::HashMap;
use std::collections::HashSet;

use specs::{Entities, Entity, Join, Read, ReadStorage, System};
use staff::resources::Root;
use stencil::components::Parent;

#[derive(Debug, Default)]
pub struct DeleteOrphans;

impl<'a> System<'a> for DeleteOrphans {
    type SystemData = (Entities<'a>, Read<'a, Root>, ReadStorage<'a, Parent>);

    fn run(&mut self, (entities, root, parents): Self::SystemData) {
        // Find which entities are attached to the root.
        let live = if let Some(root) = root.0 {
            // Invert 'parents'.
            let mut tree: HashMap<Entity, Vec<Entity>> = HashMap::new();
            for (child, parent) in (&entities, &parents).join() {
                tree.entry(parent.0).or_default().push(child);
            }

            let mut q = vec![root];
            let mut live = HashSet::new();

            // Walk the tree.
            while let Some(el) = q.pop() {
                live.insert(el);
                if let Some(children) = tree.get(&el) {
                    for child in children {
                        q.push(*child);
                    }
                }
            }

            live
        } else {
            HashSet::new()
        };

        // Remove the entities that are not live.
        for entity in entities.join() {
            if !live.contains(&entity) {
                entities.delete(entity).unwrap();
            }
        }
    }
}

// /// Collect garbage entities.
// ///
// /// Remove entities from `graph_components` `parents` that are not in the graph defined by `root`
// /// and `parents.
// #[cfg(test)]
// mod tests {
//     use crate::*;
//
//     #[test]
//     fn it_removes_everything_if_no_root() {
//         let e1 = Entity::new(1);
//         let e2 = Entity::new(2);
//
//         let mut s = HashSet::new();
//         s.insert(e1);
//         s.insert(e2);
//
//         let mut a: HashMap<Entity, ()> = HashMap::new();
//         a.insert(e1, ());
//         a.insert(e2, ());
//
//         let mut b: HashMap<Entity, ()> = HashMap::new();
//         b.insert(e2, ());
//
//         let mut parents: HashMap<Entity, Entity> = HashMap::new();
//         parents.insert(e2, e1);
//
//         sys_delete_orphans(None, &mut parents, &s, &mut [&mut a, &mut b]);
//
//         assert_eq!(a.len(), 0);
//         assert_eq!(b.len(), 0);
//         assert_eq!(parents.len(), 0);
//     }
//
//     #[test]
//     fn it_removes_entities_not_in_graph() {
//         let e1 = Entity::new(1);
//         let e2 = Entity::new(2);
//         let e3 = Entity::new(3);
//         let e4 = Entity::new(4);
//         let e5 = Entity::new(4);
//
//         let mut a: HashMap<Entity, ()> = HashMap::new();
//         a.insert(e1, ());
//         a.insert(e2, ());
//
//         let mut b: HashMap<Entity, ()> = HashMap::new();
//         b.insert(e2, ());
//         b.insert(e3, ());
//         b.insert(e5, ());
//
//         let mut s = HashSet::new();
//         s.insert(e1);
//         s.insert(e2);
//         s.insert(e3);
//         s.insert(e4);
//         s.insert(e5);
//
//         let mut parents: HashMap<Entity, Entity> = HashMap::new();
//         parents.insert(e2, e1);
//         parents.insert(e4, e3);
//
//         sys_delete_orphans(Some(e1), &mut parents, &s, &mut [&mut a, &mut b]);
//
//         assert_eq!(a.len(), 2);
//         assert!(a.contains_key(&e1));
//         assert!(a.contains_key(&e2));
//
//         assert_eq!(b.len(), 1);
//         assert!(a.contains_key(&e2));
//
//         assert_eq!(parents.len(), 1);
//     }
// }
