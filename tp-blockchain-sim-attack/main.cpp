// wrapper to run the senarios

#include <iostream>

#include "blockchain.h" // tp 4
#include "scenarios.h"
using namespace std;

int main() {
  cout << "TP5 - Blockchain attack simulation\n";
  cout << "difficulty " << DIFFICULTY << ", block reward " << BLOCK_REWARD
       << " coins\n";

  scenarioNetworkAndReorg();
  scenario51Percent();
  scenarioDoubleSpend();
  scenarioSelfishMining();
  scenarioBlockWithholding();

  cout << "\nDone.\n";
  return 0;
}
