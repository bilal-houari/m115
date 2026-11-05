#pragma once

#include "blockchain.h"

#include <string>
#include <vector>
using namespace std;

// a peer in the P2P network
struct Node {
  string name;
  int weight; // hashrate for PoW, stake for PoS
  Chain chain;
};

int pickWeightedNode(const vector<Node>& nodes, int round);
int pickWeightedIndex(const vector<int>& weights, int round, string salt);

// deterministic
int pseudoRandomPercent(string seed);

// A node adopts a candidate chain only if it is longer and valid
bool adoptIfLonger(Chain& current, const Chain& candidate);
