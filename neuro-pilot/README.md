# NEURO PILOT

Watch a neural network **learn to fly, live** — no libraries, no training data, no backprop.

120 birds per generation, each piloted by a tiny from-scratch MLP (4 inputs → 6 tanh hidden → 1 output). Birds that survive longer get more offspring; children are mutated copies of the best parents (elitism + mutation — classic neuroevolution). Within ~15–30 generations the flock goes from faceplanting into the first pipe to threading gaps indefinitely.

- Live visualization of the **champion's brain**: node activations and weight signs/strengths, updating every frame
- Record-per-generation fitness graph
- 1× / 10× / 60× evolution speed
- Seedable RNG so runs are reproducible (and testable)

Single HTML file — open `index.html` and let it cook.
