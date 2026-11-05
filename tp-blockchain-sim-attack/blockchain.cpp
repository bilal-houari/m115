// this is tp 4

#include "blockchain.h"

#include <iomanip>
#include <iostream>
#include <sstream>

// toy hashing function that's unsuitable for cryptographic use
string hashText(string text) {
  unsigned long long h = 14695981039346656037ULL;
  for (char c : text) {
    h = h ^ (unsigned char)c;
    h = h * 1099511628211ULL;
  }
  h = h ^ (h >> 33);
  h = h * 0xff51afd7ed558ccdULL;
  h = h ^ (h >> 33);
  h = h * 0xc4ceb9fe1a85ec53ULL;
  h = h ^ (h >> 33);
  ostringstream result;
  result << hex << setw(16) << setfill('0') << h;
  return result.str();
}

// calculate hash of block by concatinating it's components
string blockHash(const Block& b) {
  string all = to_string(b.index) + "|" + b.previousHash + "|" + b.miner +
               "|" + to_string(b.nonce) + "|" + to_string(b.difficulty) +
               "|" + (b.proofOfWork ? "PoW" : "PoS") + "|";
  for (string t : b.transactions) {
    all = all + t + ";";
  }
  return hashText(all);
}

// returns true of the hash of the block has the amount of zeros required by the difficulty (PoW only)
bool hasZeros(string hash, int difficulty) {
  for (int i = 0; i < difficulty; i++) {
    if (hash[i] != '0') {
      return false;
    }
  }
  return true;
}

// find a nonce of a block such that the block hash passes the hasZeros() check
Block mineBlock(const Chain& base, vector<string> transactions, string miner,
                int difficulty, bool proofOfWork) {
  Block b;
  b.index = base.height() + 1;
  b.previousHash = base.tip();
  b.transactions = transactions;
  b.miner = miner;
  b.nonce = 0;
  b.difficulty = proofOfWork ? difficulty : 0;
  b.proofOfWork = proofOfWork;
  b.hash = blockHash(b);

  if (proofOfWork) {
    while (hasZeros(b.hash, difficulty) == false) {
      b.nonce = b.nonce + 1;
      b.hash = blockHash(b);
    }
  }
  return b;
}

bool verifyChain(const Chain& chain) {
  for (int i = 0; i < chain.height(); i++) {
    const Block& b = chain.blocks[i];

    if (blockHash(b) != b.hash) {
      return false;
    }

    if (i == 0) {
      if (b.previousHash != "0") {
        return false;
      }
    } else if (b.previousHash != chain.blocks[i - 1].hash) {
      return false;
    }

    if (b.proofOfWork && hasZeros(b.hash, b.difficulty) == false) {
      return false;
    }
  }
  return true;
}

// helpers
Chain prefixOf(const Chain& chain, int height) {
  Chain result;
  for (int i = 0; i < height && i < chain.height(); i++) {
    result.blocks.push_back(chain.blocks[i]);
  }
  return result;
}

bool hasTx(const Chain& chain, const string& tx) {
  for (const Block& b : chain.blocks) {
    for (const string& t : b.transactions) {
      if (t == tx) {
        return true;
      }
    }
  }
  return false;
}

void printChain(const Chain& chain) {
  cout << "  height " << chain.height() << " tip " << chain.tip() << "\n";
  for (const Block& b : chain.blocks) {
    cout << "   #" << b.index << " " << (b.proofOfWork ? "PoW" : "PoS")
         << " by " << b.miner << " nonce " << b.nonce << " hash " << b.hash
         << "\n";
    for (const string& t : b.transactions) {
      cout << "     tx " << t << "\n";
    }
  }
}
