#import "template.typ": *

#show: project.with(
  title: "T.P. Certificate Registry",
  authors: (
    (name: "Bilal Houari", email: "houari.bilal@etu.uae.ac.ma", affiliation: "Master I.D.I.A."),
  ),
  date: "17 Novembre, 2026",
)

#let shot(path, caption, width: 90%) = figure(
  rect(stroke: gray, inset: 4pt, image(path, width: width)),
  caption: caption,
)

#show raw.where(block: false): it => box(
  fill: luma(240),
  inset: (x: 3pt),
  outset: (y: 3pt),
  radius: 3pt,
  text(font: "Adwaita Mono", size: 0.86em, it),
)

#show raw.where(block: true): it => block(
  width: 100%,
  fill: luma(246),
  radius: 3pt,
  inset: 8pt,
  text(font: "Adwaita Mono", size: 0.78em, it),
)

Le but de ce TP est de créer une application pour émettre et vérifier des certificats académiques. Comme pour le TP Mini Social Media, j'utilise Foundry pour les contrats et Anvil pour la blockchain locale. La page web permet ensuite de gérer les certificats.

= Le contrat

J'ai deux versions du contrat. `CertificateRegistry` enregistre les informations du certificat directement dans la blockchain. `CertificateNFT` crée un NFT ERC-721 pour chaque certificat. Dans les deux cas, les identifiants étudiants ne peuvent pas être utilisés deux fois. L'administrateur peut révoquer un certificat.

= Foundry et Docker

Je travaille dans mon environnement Docker Kali. J'entre dans le conteneur et je lance Foundry directement dans le terminal. Les tests couvrent les fonctionalités basiques.

```sh
cd /workspace/m115/tp-certificate
forge build
forge test
```

#shot("images/01-tests-foundry.jpeg", [Les tests des deux contrats avec Foundry.])

= Analyse de sécurité

Au début, `forge lint` signale des avertissements sur les deux contrats.

#shot("images/02-forge-lint-warnings.jpeg", [Les avertissements avant les corrections.])

Après les corrections, je relance la commande. Elle ne signale plus d'avertissements.

#shot("images/02-forge-lint-clean.jpeg", [`forge lint` termine sans avertissement.])

= Anvil et Enkrypt

Je démarre Anvil avec Docker. Comme pour mon TP précédent, j'utilise une blockchain locale avec des comptes de test déjà approvisionnés. Anvil écoute sur le port `8545` et utilise le chain ID `31337`.

```sh
docker compose -f compose.yaml --profile blockchain up -d anvil
```

Dans Enkrypt, j'ajoute le réseau Anvil Local avec le RPC `http://127.0.0.1:8545` et le chain ID `31337`. J'importe le compte de test 1 : il possède le registre classique et peut émettre des NFT.

#shot("images/03-enkrypt-network.jpeg", [Le réseau Anvil Local est ajouté dans Enkrypt.])

#shot("images/04-enkrypt-anvil-wallet.jpeg", [Le portefeuille Enkrypt utilise le réseau Anvil Local.])

Une fois connecté à la page, le portefeuille apparaît comme administrateur du registre.

#shot("images/05-app-wallet-connected.jpeg", [Le portefeuille est connecté à l'application.])

= Déploiement des contrats

Je déploie les deux contrats avec les scripts Foundry :

```sh
cd /workspace/m115/tp-certificate
forge script script/Deploy.s.sol:DeployScript --rpc-url http://anvil:8545 --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
forge script script/DeployNFT.s.sol:DeployNFTScript --rpc-url http://anvil:8545 --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

Je copie les deux adresses affichées dans `.env.local`, puis je lance la page avec `npm run dev`.

#shot("images/06-deploy-registry.jpeg", [Le déploiement du registre classique avec Foundry.])

#shot("images/07-deploy-nft.jpeg", [Le déploiement du contrat NFT et l'attribution des rôles.])

= Émission depuis la page web

Dans l'onglet Registry records, je remplis le formulaire et je confirme la transaction dans Enkrypt. Le statut et le hash de transaction s'affichent dans la page.

#shot("images/08-issue-confirmation.jpeg", [Je confirme l'émission dans Enkrypt.])

= Vérification

La recherche d'un certificat est publique. Dans Registry records, je saisis son numéro pour voir les informations et son statut.

#shot("images/09-registry-verification.jpeg", [Le certificat classique est affiché après la recherche.])

Dans l'onglet ERC-721 tokens, je peux aussi rechercher le NFT et voir ses informations, son propriétaire et son statut.

#shot("images/10-nft-verification.jpeg", [Le certificat NFT est affiché après la recherche.])

= Transaction dans le terminal

Pour voir le reçu d'une transaction, je reprends son hash dans la page. Dans le shell Kali, je lance `cast receipt` :

```sh
cd /workspace/m115/tp-certificate
cast receipt <hash-de-transaction> --rpc-url http://anvil:8545
```

#shot("images/11-transaction-receipt.jpeg", [Le reçu de la transaction est visible dans le terminal.])
