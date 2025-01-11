<div align="center">

# 🌸 Hana Shortner

*Un raccourcisseur d'URL élégant et minimaliste*

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)
[![Website](https://img.shields.io/website?url=http%3A%2F%2Fhana.root.sx)](http://hana.root.sx)

</div>

---

## 📝 Table des Matières

- [À propos](#about)
- [Fonctionnalités](#features)
- [Installation](#getting_started)
- [Utilisation](#usage)
- [Déploiement](#deployment)
- [Technologies](#built_using)
- [Contribution](#contributing)
 
## 🧐 À propos <a name = "about"></a>

Hana Shortner est un service de raccourcissement d'URL moderne et efficace, hébergé sur hana.root.sx. Le nom "Hana" (花), signifiant "fleur" en japonais, reflète notre philosophie de conception : simplicité, élégance et efficacité.

## ⭐ Fonctionnalités <a name = "features"></a>

- 🚀 Raccourcissement d'URL instantané
- 📊 Statistiques de clics en temps réel (en développement)
- 📱 Interface responsive
- ⚡ Performances optimisées
- 🎯 API RESTful
- 🌍 Support des caractères internationaux (english & french for now)

## 🏁 Installation <a name = "getting_started"></a>

Ces instructions vous permettront d'obtenir une copie du projet et de le faire fonctionner sur votre machine locale.

### Prérequis

```bash
node >= 16.0.0
npm >= 7.0.0
```

### Installation

1. Clonez le dépôt
```bash
git clone https://github.com/ArizakiDev/hana-shortner.git
```

2. Installez les dépendances
```bash
cd hana-shortner
npm install
```

3. Configurez les variables d'environnement
```bash
./config/db.js
# Ajouter votre ligne mongoose
```

4. Lancez le serveur
```bash
node server.js
```

## 🎈 Utilisation <a name = "usage"></a>

### Interface Web

1. Visitez https://hana.root.sx
2. Collez votre URL longue
3. Cliquez sur "Raccourcir"
4. Copiez et partagez votre URL courte

### API

```bash
curl "http://hana.nix3.ru:60/api/shorten?originalUrl=VotreUrl"

```

## 🚀 Déploiement <a name = "deployment"></a>

Le déploiement peut être effectué sur n'importe quel service compatible Node.js :

```bash
node server.js
```

## ⛏️ Technologies <a name = "built_using"></a>

- [Node.js](https://nodejs.org/) - Environnement d'exécution
- [Express](https://expressjs.com/) - Framework serveur
- [MongoDB](https://www.mongodb.com/) - Base de données

## 🤝 Contribution <a name = "contributing"></a>

Les contributions sont ce qui fait de la communauté open source un endroit incroyable pour apprendre, inspirer et créer. Toutes les contributions que vous faites sont **grandement appréciées**.

1. Forkez le projet
2. Créez votre branche de fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Poussez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

<div align="center">
  
📮 [Site Web](https://hana.root.sx) · 📬 [Documentation](https://hana.root.sx/docs) · 💌 [Signaler un Bug](https://github.com/ArizakiDev/hana-shortner/issues)

</div>
