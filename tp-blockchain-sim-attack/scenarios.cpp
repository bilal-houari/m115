// tp 5. llm used.
// read the output (tp-5.out.txt) to get a feel to how the simulation works.

#include "scenarios.h"

#include "blockchain.h"
#include "network.h"

#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

// Scenario 1: P2P network, a fork, and a chain reorg

void scenarioNetworkAndReorg() {
  cout << "\n=== 1. P2P network: broadcast, fork and longest-chain reorg ===\n";

  vector<Node> net = {
      {"Alice", 50, {}},
      {"Bob", 30, {}},
      {"Carol", 20, {}},
  };

  // Four blocks mined and broadcast to every node.
  for (int round = 1; round <= 4; round++) {
    int m = pickWeightedNode(net, round);
    Block b = mineBlock(net[m].chain, {"tx " + to_string(round)}, net[m].name,
                        DIFFICULTY, true);
    for (Node& n : net) {
      n.chain.blocks.push_back(b); // broadcast to all peers
    }
  }

  cout << "after 4 honest rounds, every node has the same chain:\n";
  for (Node& n : net) {
    cout << "  " << n.name << " ->";
    printChain(n.chain);
  }
  cout << "  chain valid: " << (verifyChain(net[0].chain) ? "yes" : "no")
       << "\n";

  // Carol builds a private fork from block 2 (blocks 3 and 4 are replaced).
  Chain privateFork = prefixOf(net[2].chain, 2);
  privateFork.blocks.push_back(
      mineBlock(privateFork, {"Carol->Dave:5"}, "Carol", DIFFICULTY, true));
  privateFork.blocks.push_back(
      mineBlock(privateFork, {"Carol->Dave:7"}, "Carol", DIFFICULTY, true));
  privateFork.blocks.push_back(
      mineBlock(privateFork, {"Carol->Dave:9"}, "Carol", DIFFICULTY, true));

  cout << "\nCarol has been mining a private fork from block 2:\n";
  cout << "  public chain: height " << net[0].chain.height() << " tip "
       << net[0].chain.tip() << "\n";
  cout << "  private fork: height " << privateFork.height() << " tip "
       << privateFork.tip() << "\n";
  cout << "  both chains are valid: "
       << (verifyChain(net[0].chain) && verifyChain(privateFork) ? "yes" : "no")
       << "\n";

  // The private fork is longer, so nodes replace blocks 3 and 4.
  cout << "\nCarol broadcasts the fork; nodes follow the longest chain:\n";
  for (Node& n : net) {
    bool reorged = adoptIfLonger(n.chain, privateFork);
    cout << "  " << n.name << (reorged ? " REORGED" : " kept old chain")
         << " -> height " << n.chain.height() << " tip " << n.chain.tip()
         << "\n";
  }
  cout << "  transactions from old blocks 3 and 4 are dropped (orphaned).\n";
}

// 51% attack helper: honest chain vs attacker private fork

const string VICTIM_TX = "Alice->Merchant:10 (payment)";
const string DOUBLE_SPEND_TX = "Alice->Mallory:10 (same coins)";

struct AttackResult {
  Chain publicChain;
  Chain attackerChain;
  Chain canonical;
  int attackerBlocks;
  int honestBlocks;
  bool success;
};

// A simple discrete round model:
//   - the victim payment is in the first public block after the fork point
//   - the attacker mines on its private fork, starting one block behind
//   - each round one side finds a block, in proportion to its share
//   - at the end, the longest chain wins
AttackResult runMajorityAttack(int attackerShare, int rounds, bool proofOfWork,
                               int difficulty) {
  AttackResult result;

  // Common prefix: two blocks both sides agree on.
  Chain base;
  base.blocks.push_back(
      mineBlock(base, {"setup 1"}, "setup", difficulty, proofOfWork));
  base.blocks.push_back(
      mineBlock(base, {"setup 2"}, "setup", difficulty, proofOfWork));

  // Honest/public chain contains the victim payment at height 3.
  result.publicChain = base;
  result.publicChain.blocks.push_back(mineBlock(
      result.publicChain, {VICTIM_TX}, "honest", difficulty, proofOfWork));

  // Attacker forked from height 2, so its chain does not contain the payment.
  result.attackerChain = base;

  result.attackerBlocks = 0;
  result.honestBlocks = 0;

  // Split the rounds exactly according to the announced share.
  // floor(round * share / 100) gives exactly share blocks per 100 rounds.
  for (int round = 1; round <= rounds; round++) {
    int before = ((round - 1) * attackerShare) / 100;
    int after = (round * attackerShare) / 100;
    bool attackerTurn = after > before;

    if (attackerTurn) {
      result.attackerChain.blocks.push_back(
          mineBlock(result.attackerChain, {DOUBLE_SPEND_TX}, "Mallory",
                    difficulty, proofOfWork));
      result.attackerBlocks++;
    } else {
      result.publicChain.blocks.push_back(
          mineBlock(result.publicChain, {"honest tx " + to_string(round)},
                    "honest", difficulty, proofOfWork));
      result.honestBlocks++;
    }
  }

  result.success =
      result.attackerChain.height() > result.publicChain.height();
  result.canonical = result.success ? result.attackerChain : result.publicChain;
  return result;
}

void printMajorityAttack(int share, bool proofOfWork) {
  int rounds = 100;
  AttackResult r =
      runMajorityAttack(share, rounds, proofOfWork, DIFFICULTY);

  cout << "  attacker controls " << share << "% of "
       << (proofOfWork ? "computing power (PoW)" : "stake (PoS)") << "\n";
  cout << "  after " << rounds << " rounds: attacker " << r.attackerBlocks
       << " blocks, honest " << r.honestBlocks
       << " blocks (+1 victim block)\n";
  cout << "  public height " << r.publicChain.height()
       << ", attacker height " << r.attackerChain.height() << "\n";
  cout << "  verdict: "
       << (r.success ? "SUCCESS - longer fork replaces the public chain"
                     : "FAILED - attacker fork is not longer")
       << "\n";
}

// Scenario 2: 51% attack on PoW (hashrate) and PoS (stake)

void scenario51Percent() {
  cout << "\n=== 2. 51% attack on proof of work (hashrate) ===\n";
  cout << "  A 51% miner can outrun the honest chain and rewrite history.\n";
  printMajorityAttack(51, true);
  cout << "  49% is not enough over the same number of rounds:\n";
  printMajorityAttack(49, true);

  cout << "\n=== 3. 51% attack on proof of stake (amount/stake) ===\n";
  cout << "  Same idea, but the weight is the stake instead of the hashrate.\n";
  printMajorityAttack(51, false);
  cout << "  45% stake cannot take over the longest chain:\n";
  printMajorityAttack(45, false);
}

// Scenario 4: double spending

void scenarioDoubleSpend() {
  cout << "\n=== 4. Double spending with a 51%+ attacker ===\n";

  // 60% makes the attack reliable with only one confirmation.
  AttackResult r = runMajorityAttack(60, 80, true, DIFFICULTY);

  cout << "  1. Alice pays the merchant: " << VICTIM_TX << "\n";
  cout << "     The payment is in public block 3 and the merchant ships.\n";
  cout << "  2. Alice (60% hashrate) secretly mines a fork from block 2\n";
  cout << "     with a conflicting spend: " << DOUBLE_SPEND_TX << "\n";
  cout << "  3. Attack result: "
       << (r.success ? "her fork is longer, the network reorgs" :
                      "her fork is not longer, no reorg")
       << "\n";
  cout << "  4. Payment still confirmed after the reorg: "
       << (hasTx(r.canonical, VICTIM_TX) ? "yes" : "no") << "\n";
  cout << "     Conflicting spend in canonical chain: "
       << (hasTx(r.canonical, DOUBLE_SPEND_TX) ? "yes" : "no") << "\n";
  cout << "     The merchant lost the goods and the payment was undone.\n";
}

// Scenario 5: selfish mining

void scenarioSelfishMining() {
  cout << "\n=== 5. Selfish mining (withholding blocks on a private fork) ===\n";

  const int attackerHashrate = 40;
  const int rounds = 120;

  Chain publicChain;
  publicChain.blocks.push_back(
      mineBlock(publicChain, {"start"}, "setup", DIFFICULTY, true));
  Chain privateChain = publicChain;

  int commonHeight = publicChain.height();
  int orphanedHonest = 0;

  for (int round = 1; round <= rounds; round++) {
    int roll = pseudoRandomPercent("selfish " + to_string(round));
    bool attackerTurn = roll < attackerHashrate;

    if (attackerTurn) {
      privateChain.blocks.push_back(
          mineBlock(privateChain, {"Mallory tx " + to_string(round)},
                    "Mallory", DIFFICULTY, true));

      // With a two-block lead, publish and orphan the honest blocks.
      if (privateChain.height() - publicChain.height() >= 2) {
        orphanedHonest = orphanedHonest + (publicChain.height() - commonHeight);
        publicChain = privateChain;
        commonHeight = publicChain.height();
      }
    } else {
      publicChain.blocks.push_back(
          mineBlock(publicChain, {"honest tx " + to_string(round)}, "Honest",
                    DIFFICULTY, true));

      if (privateChain.height() >= publicChain.height()) {
        // Simplified tie rule: the attacker publishes first, so a tie goes
        // to the private fork and the honest block becomes orphaned.
        orphanedHonest = orphanedHonest + (publicChain.height() - commonHeight);
        publicChain = privateChain;
        commonHeight = publicChain.height();
      } else {
        // Honest chain is longer: the attacker abandons its private work.
        privateChain = publicChain;
        commonHeight = publicChain.height();
      }
    }
  }

  if (privateChain.height() > publicChain.height()) {
    orphanedHonest = orphanedHonest + (publicChain.height() - commonHeight);
    publicChain = privateChain;
  }

  int malloryBlocks = 0;
  int honestBlocks = 0;
  for (const Block& b : publicChain.blocks) {
    if (b.miner == "Mallory") {
      malloryBlocks++;
    } else if (b.miner == "Honest") {
      honestBlocks++;
    }
  }

  double share = 100.0 * malloryBlocks / (malloryBlocks + honestBlocks);

  cout << "  attacker hashrate: " << attackerHashrate << "%\n";
  cout << "  canonical blocks: Mallory " << malloryBlocks << ", honest "
       << honestBlocks << "\n";
  cout << "  honest blocks orphaned by the attacker: " << orphanedHonest
       << "\n";
  cout << "  attacker share of the canonical chain: " << fixed
       << setprecision(1) << share << "%\n";
  cout << "  With less than 50% hashrate, withholding still lets the\n";
  cout << "  attacker steal a larger share by making honest work orphaned.\n";
}

// Scenario 6: block withholding in a mining pool

struct PoolMember {
  string name;
  int share; // percentage of the pool's hashrate
  bool withholds;
};

void scenarioBlockWithholding() {
  cout << "\n=== 6. Block withholding in a mining pool ===\n";
  cout << "  Pool members: Alice 25%, Bob 25%, Carol 25%, Mallory 25%.\n";
  cout << "  Mallory still sends partial shares but withholds full blocks.\n";

  vector<PoolMember> pool = {
      {"Alice", 25, false},
      {"Bob", 25, false},
      {"Carol", 25, false},
      {"Mallory", 25, true},
  };
  vector<int> weights;
  for (const PoolMember& m : pool) {
    weights.push_back(m.share);
  }

  const int rounds = 100;
  double revenue[2] = {0.0, 0.0};

  for (int attack = 0; attack <= 1; attack++) {
    Chain chain;
    vector<int> found(pool.size(), 0);
    vector<int> accepted(pool.size(), 0);

    for (int round = 1; round <= rounds; round++) {
      int m = pickWeightedIndex(weights, round, "pool ");
      found[m]++;

      if (attack == 1 && pool[m].withholds) {
        continue; // full block found but not given to the pool
      }

      chain.blocks.push_back(mineBlock(chain, {"pool tx " + to_string(round)},
                                       pool[m].name, DIFFICULTY, true));
      accepted[m]++;
    }

    cout << "\n  " << (attack == 0 ? "normal pool" : "withholding attack")
         << ":\n";
    cout << "    blocks accepted by the network: " << chain.height() << "\n";
    for (int i = 0; i < (int)pool.size(); i++) {
      cout << "    " << pool[i].name << ": found " << found[i]
           << ", accepted " << accepted[i] << "\n";
    }

    revenue[attack] = chain.height() * BLOCK_REWARD;
    cout << "    pool revenue: " << revenue[attack] << " coins\n";
    cout << "    Mallory payout (paid on shares): "
         << revenue[attack] * pool[3].share / 100.0 << " coins\n";
    cout << "    honest members payout: "
         << revenue[attack] * (100 - pool[3].share) / 100.0 << " coins\n";
  }

  double drop = 100.0 * (revenue[0] - revenue[1]) / revenue[0];
  cout << "\n  Mallory's withheld blocks never reach the chain.\n";
  cout << "  Pool revenue drops by " << fixed << setprecision(1) << drop
       << "%: a rival pool can use this to damage a competitor\n";
  cout << "  while still receiving share-based payouts.\n";
}
