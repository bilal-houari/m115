#pragma once

#include <string>
#include <vector>
using namespace std;

inline constexpr int DIFFICULTY = 3;
inline constexpr int BLOCK_REWARD = 50;

// Hashing (same function as TP4).
string hashText(string text);
bool hasZeros(string hash, int difficulty);

// Blocks and chains (same model as TP4 exercise 4).
struct Block {
  int index;
  string previousHash;
  vector<string> transactions;
  string miner;
  long long nonce;
  int difficulty;
  bool proofOfWork;
  string hash;
};

struct Chain {
  vector<Block> blocks;

  int height() const { return (int)blocks.size(); }
  string tip() const { return blocks.empty() ? string("0") : blocks.back().hash; }
};

string blockHash(const Block& b);
Block mineBlock(const Chain& base, vector<string> transactions, string miner,
                int difficulty, bool proofOfWork);
bool verifyChain(const Chain& chain);
Chain prefixOf(const Chain& chain, int height);
bool hasTx(const Chain& chain, const string& tx);
void printChain(const Chain& chain);
