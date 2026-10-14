# Neuro Pilot

A neuroevolution demo. Each generation, 120 birds try to fly through a row of pipes, and each bird is steered by its own small neural network. The ones that last longest become the parents of the next generation. You can watch the best bird's network fire in real time, follow the record time per generation on a graph, and speed evolution up to 10x or 60x.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| 1x / 10x / 60x | simulation speed |
| restart evolution | start over from random networks |

## How it works

- Each network has 4 inputs, 6 tanh hidden units, and 1 tanh output. The inputs are the vertical offset to the next gap, the distance to the next pipe, the bird's vertical speed, and a constant 1. If the output is above zero, the bird flaps.
- A bird's fitness is how many seconds it stays alive. A generation ends when every bird has crashed or after 90 seconds.
- The top 25% become parents. The best two are copied unchanged, and the rest of the new population are mutated copies of random parents: each weight has a 15% chance of being nudged by up to 0.5.
- There's no backpropagation and no training data. The networks only improve through selection and mutation.
- The brain panel draws the current best bird's network. Line color shows a weight's sign, line thickness its size, and node brightness its activation.
- The random number generator is a seedable mulberry32.
