<img width="1536" height="1024" alt="squibbles" src="https://github.com/user-attachments/assets/0f2f7c50-a17e-4092-a27d-0d0152f2f230" />
##🌟 Features


🚮 Simulation Mechanics

Reproduction and Mutation: Creatures reproduce when well-fed and hydrated, passing on averaged traits and potentially gaining new mutations.

Gestation and Fertility: Each creature has gestation time, offspring count, and infertility chance, influenced by mutations like Fertile, Infertile, Brood Sac, and Twin Gene.

Stat Scaling with Age: Traits evolve with life stage (child, adult, geriatric), influencing attractiveness and combat.

Day/Night Cycle: 30 seconds of day and 30 seconds of night with visual indicators and mutation-based interactions (e.g., Bioluminescent).

Real-Time Stats Panel: Displays averages for speed, vision, aggression, attractiveness, attack, defense, offspring count, infertility, health, etc.

Click-to-Follow: Click any creature to view detailed real-time stats and follow them with the camera.

Zoom and Pan: Use scroll to zoom and WASD/arrows to pan the map.

#🌿 Biomes

Types: PLAINS, DESERT, RAINFOREST, TUNDRA

Effect on Behavior:

Movement penalties in RAINFOREST and TUNDRA

Food/water distribution adjusted by biome

Biome-based pack formation (Pack mentality)

#🤍 Mutation System

Over 50 unique mutations with various types of effects:


⚔️ Stat Modifiers

Extra Arms, Extra Legs, Scales, Stone Skin, Glass Bones, etc. impact attack, speed, vision, defense, attractiveness, and more.

Stats are clamped and mutations stack over generations.


🤺 Behavioral Traits

Cannibal, Child Eater, Pregnancy Hunter: Target specific victims for feeding.

Immortal: Prevents death from age, hunger, or thirst.

Burrower: Burrow and become invulnerable when hurt.

Photosynthetic Skin: Heals slowly during daytime.

Pack mentality: Forms packs that forage, return, and fight together.

Rage State & Blood Frenzy: Combat stat boosts under certain triggers.

#🧰 Advanced Interactions

Radioactive: Deals AoE damage and mutates nearby creatures.

Parasitic Womb: Implants offspring in another creature.

Loyal Mate: Boosts stats when near mate.

Hyperaware & Paranoia: Advanced threat detection and evasion.

Null Core: Suppresses all mutation effects.

#📉 Visual Effects

Glows, outlines, and icons indicate various states (burrowed, pregnant, child, parasitized, pack, etc.)

Health bars show green-yellow-red gradients.

Bioluminescent, Slippery Skin, Tail Whip, and Rage State have color-coded overlays.

#📊 Statistics Dashboard

View live: population, total kills, average age/lifespan, mutation impact

Stats include full range: min, max, and average for each tracked attribute

#🎓 How to Run

Requirements

pip install pygame

Run the Simulation

python evolution_simulation_fully_integrated9.py

You will be prompted to enter setup parameters like:

Number of creatures (default: 50)

Food spawns (default: 30)

Water spawns (default: 30)

Map size (default: 1000x800)

#👀 Controls

Action

Key/Mouse

Select Creature

Left Click

Deselect

ESC

Move Camera

WASD / Arrows

Zoom

Scroll Wheel

Toggle Stats


#📊 Interesting Scenarios

Aggressive bloodlines eliminating peaceful ones

Cannibals forming echo chambers of violence

Immortals dominating territory

Radioactive creatures creating chaos zones

Parasitic womb chains infecting entire populations

#🎯 Goals for Expansion

Visual lineage trees

Different foods that provide more/less hunger, other uniqueness. IE: Fruit trees, berries, cactus etc.

Traits that make creatures prefer different types of food, fruit, veggies, fish, (other new creatures?)

Traits that force creatures to not be able to access certain kinds of food in certain biomes, or gives them access to certain food in certain biomes.

Biome specific food.

Environmental hazards and disease

Weather in the different biomes

Dominant and recessive genotyping

Expanded set of creatures with varying behaviors that interact

Improved AI for creatures

UI Beautification

Statistical printout of all the stat averages and population report during your simulation

Graphical overhaul

Graphical representation and variation of traits and mutation

Climate-based migration patterns?

User-defined biomes and more user input to the simulation

#📚 Files

evolution_simulation_fully_integrated9.py: Main simulation loop, UI, logic

mutations.py: Mutation definitions, effects, behaviors, and interaction logic

#📖 License

MIT License. Hack it, fork it, evolve it.

