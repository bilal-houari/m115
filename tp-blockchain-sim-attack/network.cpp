// simulating the P2P network

#include "network.h"

#include <cstdlib>

int pickWeightedNode(const vector<Node>& nodes, int round) {
  int total = 0;
  for (const Node& n : nodes) {
    total = total + n.weight;
  }

  string h = hashText("pick " + to_string(round));
  unsigned long long value = strtoull(h.substr(0, 8).c_str(), NULL, 16);
  int target = (int)(value % total);

  int sum = 0;
  for (int i = 0; i < (int)nodes.size(); i++) {
    sum = sum + nodes[i].weight;
    if (target < sum) {
      return i;
    }
  }
  return 0;
}

int pickWeightedIndex(const vector<int>& weights, int round, string salt) {
  int total = 0;
  for (int w : weights) {
    total = total + w;
  }

  string h = hashText(salt + to_string(round));
  unsigned long long value = strtoull(h.substr(0, 8).c_str(), NULL, 16);
  int target = (int)(value % total);

  int sum = 0;
  for (int i = 0; i < (int)weights.size(); i++) {
    sum = sum + weights[i];
    if (target < sum) {
      return i;
    }
  }
  return 0;
}

// deterministic pseudo-random number in [0, 99]
int pseudoRandomPercent(string seed) {
  string h = hashText(seed);
  unsigned long long value = strtoull(h.substr(0, 8).c_str(), NULL, 16);
  return (int)(value % 100);
}

// discard chain owned by the node if broadcasted chain is longer
bool adoptIfLonger(Chain& current, const Chain& candidate) {
  if (candidate.height() > current.height() && verifyChain(candidate)) {
    current = candidate;
    return true;
  }
  return false;
}
