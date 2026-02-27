export type Language = "zh" | "en" | "ja" | "fr";

export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    add: string;
    close: string;
    confirm: string;
  };

  // Game Setup
  setup: {
    title: string;
    numPlayers: string;
    lapsToWin: string;
    eventDensity: string;
    eventDensityLow: string;
    eventDensityHigh: string;
    manageLibraries: string;
    startGame: string;
  };

  // Game Settings
  settings: {
    title: string;
    backgroundSettings: string;
    backgroundColor: string;
    backgroundImage: string;
    playerAvatars: string;
    playerName: string;
    uploadAvatar: string;
    uploadBackground: string;
    selectColor: string;
    imageUrl: string;
    imageUrlPlaceholder: string;
    colorCodeInput: string;
    uploadFailed: string;
  };

  // Config Manager
  configManager: {
    title: string;
    exportConfig: string;
    exportToNetwork: string;
    exportLocal: string;
    importConfig: string;
    importFromId: string;
    importFromFile: string;
    configId: string;
    idPlaceholder: string;
    shareableId: string;
    exportDescription: string;
    importDescription: string;
    selectFile: string;
    import: string;
    exportSuccess: string;
    importSuccess: string;
    downloadSuccess: string;
    exportFailed: string;
    importFailed: string;
    localImportSuccess: string;
    invalidFormat: string;
    enterConfigId: string;
  };

  // Card Editor
  cardEditor: {
    title: string;
    save: string;
    createNew: string;
    name: string;
    emoji: string;
    description: string;
    rarity: string;
    target: string;
    targetSelf: string;
    targetPickOne: string;
    targetRandomOther: string;
    targetAllOthers: string;
    effectType: string;
    moveDistance: string;
    moveHint: string;
    addCard: string;
  };

  // Event Editor
  eventEditor: {
    title: string;
    save: string;
    createNew: string;
    content: string;
    color: string;
    target: string;
    targetSelf: string;
    targetAllPlayers: string;
    targetRandomOther: string;
    effect: string;
    effectNone: string;
    effectMove: string;
    effectRestart: string;
    effectSkip: string;
    value: string;
    valueHint: string;
    effectLabel: string;
    addEvent: string;
    noEvents: string;
    placeholder: string;
  };

  // Game
  game: {
    abort: string;
    abortMessage: string;
    taskComplete: string;
    cardUsed: string;
    eventAnomaly: string;
    victory: string;
    pilotWonOrbit: string;
    restartGame: string;
    collision: string;
    skipTurn: string;
    battleInitialized: string;
    noEventsAlert: string;
    handCards: string;
    handCardsListTitle: string;
    noAvailableCards: string;
    cancelSelect: string;
    selectTarget: string;
    randomizing: string;
    allTargets: string;
  };

  // Player names
  player: string;
  circle: string;
  cancel: string;
}

const zh: Translations = {
  common: {
    save: "保存",
    cancel: "取消",
    delete: "删除",
    add: "添加",
    close: "关闭",
    confirm: "确认",
  },
  setup: {
    title: "星际派对配置",
    numPlayers: "玩家人数",
    lapsToWin: "胜利圈数",
    eventDensity: "事件密度",
    eventDensityLow: "低密度：事件较稀少",
    eventDensityHigh: "高密度：步步惊心",
    manageLibraries: "库管理",
    startGame: "启动任务",
  },
  settings: {
    title: "游戏设置",
    backgroundSettings: "背景设置",
    backgroundColor: "纯色背景",
    backgroundImage: "图片背景",
    playerAvatars: "玩家头像",
    playerName: "玩家名称",
    uploadAvatar: "上传头像",
    uploadBackground: "上传",
    selectColor: "选择预设颜色",
    imageUrl: "图片 URL 或上传图片",
    imageUrlPlaceholder: "https://example.com/image.jpg",
    colorCodeInput: "或输入颜色代码：",
    uploadFailed: "上传失败",
  },
  configManager: {
    title: "配置导入导出",
    exportConfig: "导出配置",
    exportToNetwork: "导出到网络",
    exportLocal: "导出本地",
    importConfig: "导入配置",
    importFromId: "从配置ID导入",
    importFromFile: "从本地文件导入",
    configId: "配置ID",
    idPlaceholder: "输入8位配置ID...",
    shareableId: "配置ID (可分享给他人)",
    exportDescription: "导出当前卡牌和事件配置到网络存储或本地文件",
    importDescription: "从网络存储或本地文件导入配置",
    selectFile: "选择文件",
    import: "导入",
    exportSuccess: "配置导出成功",
    importSuccess: "配置导入成功",
    downloadSuccess: "配置已下载到本地",
    exportFailed: "导出失败",
    importFailed: "导入失败",
    localImportSuccess: "本地配置导入成功",
    invalidFormat: "配置格式无效",
    enterConfigId: "请输入配置ID",
  },
  cardEditor: {
    title: "战术卡牌编辑器",
    save: "保存并返回",
    createNew: "设计新武器",
    name: "名称",
    emoji: "Emoji",
    description: "描述",
    rarity: "稀有度",
    target: "目标",
    targetSelf: "自己",
    targetPickOne: "指定一人",
    targetRandomOther: "随机对手",
    targetAllOthers: "全部对手",
    effectType: "效果类型",
    moveDistance: "移动格数",
    moveHint: "正数前进，负数后退",
    addCard: "确认添加",
  },
  eventEditor: {
    title: "事件编辑器",
    save: "保存并返回",
    createNew: "新增大冒险内容",
    content: "内容 (任务内容)",
    color: "事件颜色",
    target: "影响目标",
    targetSelf: "当前玩家",
    targetAllPlayers: "所有玩家",
    targetRandomOther: "随机其他玩家",
    effect: "游戏效果",
    effectNone: "无效果",
    effectMove: "移动格数",
    effectRestart: "回起点",
    effectSkip: "暂停",
    value: "数值",
    valueHint: "正数前进，负数后退",
    effectLabel: "效果",
    addEvent: "确认添加",
    noEvents: "暂无自定义事件",
    placeholder: "例如：做5个深蹲",
  },
  game: {
    abort: "Abort Mission?",
    abortMessage: "确定要退出游戏吗?",
    taskComplete: "任务已完成",
    cardUsed: "{name} 使用了 [{card}]",
    eventAnomaly: "Event Anomaly",
    victory: "Victory",
    pilotWonOrbit: "Pilot P{id} Won the Orbit",
    restartGame: "Restart Game",
    collision: "💥 撞击！P{id} 重启",
    skipTurn: "{name} 状态异常，跳过本轮。",
    battleInitialized: "战场初始化完成。准备开始任务。",
    noEventsAlert: "请先添加至少一个事件！",
    handCards: "战术手牌",
    handCardsListTitle: "手牌列表",
    noAvailableCards: "当前无可用战术手牌",
    cancelSelect: "取消选择",
    selectTarget: "选择目标",
    randomizing: "随机选择中...",
    allTargets: "所有玩家",
  },
  player: "玩家",
  circle: "圈",
  cancel: "取消",
};

const en: Translations = {
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    add: "Add",
    close: "Close",
    confirm: "Confirm",
  },
  setup: {
    title: "Space Party Config",
    numPlayers: "Number of Players",
    lapsToWin: "Laps to Win",
    eventDensity: "Event Density",
    eventDensityLow: "Low Density: Rare Events",
    eventDensityHigh: "High Density: Event Every Step",
    manageLibraries: "Manage Libraries",
    startGame: "Start Game",
  },
  settings: {
    title: "Game Settings",
    backgroundSettings: "Background Settings",
    backgroundColor: "Solid Color",
    backgroundImage: "Image Background",
    playerAvatars: "Player Avatars",
    playerName: "Player Name",
    uploadAvatar: "Upload Avatar",
    uploadBackground: "Upload",
    selectColor: "Select Preset Color",
    imageUrl: "Image URL or Upload",
    imageUrlPlaceholder: "https://example.com/image.jpg",
    colorCodeInput: "Or enter color code:",
    uploadFailed: "Upload failed",
  },
  configManager: {
    title: "Config Import/Export",
    exportConfig: "Export Config",
    exportToNetwork: "Export to Network",
    exportLocal: "Export Local",
    importConfig: "Import Config",
    importFromId: "Import from Config ID",
    importFromFile: "Import from Local File",
    configId: "Config ID",
    idPlaceholder: "Enter 8-char config ID...",
    shareableId: "Config ID (Shareable)",
    exportDescription:
      "Export current card and event config to network or local file",
    importDescription: "Import config from network or local file",
    selectFile: "Select File",
    import: "Import",
    exportSuccess: "Config exported successfully",
    importSuccess: "Config imported successfully",
    downloadSuccess: "Config downloaded to local",
    exportFailed: "Export failed",
    importFailed: "Import failed",
    localImportSuccess: "Local config imported successfully",
    invalidFormat: "Config format invalid",
    enterConfigId: "Please enter config ID",
  },
  cardEditor: {
    title: "Tactical Card Editor",
    save: "Save and Return",
    createNew: "Design New Card",
    name: "Name",
    emoji: "Emoji",
    description: "Description",
    rarity: "Rarity",
    target: "Target",
    targetSelf: "Self",
    targetPickOne: "Pick One",
    targetRandomOther: "Random Other",
    targetAllOthers: "All Others",
    effectType: "Effect Type",
    moveDistance: "Move Steps",
    moveHint: "Positive to advance, negative to retreat",
    addCard: "Add Card",
  },
  eventEditor: {
    title: "Event Editor",
    save: "Save and Return",
    createNew: "Add New Event",
    content: "Event Content",
    color: "Event Color",
    target: "Target",
    targetSelf: "Current Player",
    targetAllPlayers: "All Players",
    targetRandomOther: "Random Other Player",
    effect: "Game Effect",
    effectNone: "None",
    effectMove: "Move",
    effectRestart: "Restart",
    effectSkip: "Skip",
    value: "Value",
    valueHint: "Positive to advance, negative to retreat",
    effectLabel: "Effect",
    addEvent: "Add Event",
    noEvents: "No custom events",
    placeholder: "e.g.: Do 5 squats",
  },
  game: {
    abort: "Abort Mission?",
    abortMessage: "Are you sure you want to quit the game?",
    taskComplete: "Task Completed",
    cardUsed: "{name} used [{card}]",
    eventAnomaly: "Event Anomaly",
    victory: "Victory",
    pilotWonOrbit: "Pilot P{id} Won the Orbit",
    restartGame: "Restart Game",
    collision: "💥 Collision! P{id} Restarted",
    skipTurn: "{name} is in an abnormal state, skipping this turn.",
    battleInitialized: "Battle field initialized. Ready to start the mission.",
    noEventsAlert: "Please add at least one event first!",
    handCards: "Tactical Hand Cards",
    handCardsListTitle: "Hand Cards List",
    noAvailableCards: "No available tactical cards currently",
    cancelSelect: "Cancel Selection",
    selectTarget: "Select Target",
    randomizing: "Randomizing...",
    allTargets: "All Players",
  },
  player: "Player",
  circle: "Circle",
  cancel: "Cancel",
};

const ja: Translations = {
  common: {
    save: "保存",
    cancel: "キャンセル",
    delete: "削除",
    add: "追加",
    close: "閉じる",
    confirm: "確認",
  },
  setup: {
    title: "スペースパーティ設定",
    numPlayers: "プレイヤー数",
    lapsToWin: "勝利ラップ",
    eventDensity: "イベント密度",
    eventDensityLow: "低密度：イベントが少ない",
    eventDensityHigh: "高密度：毎ステップイベント",
    manageLibraries: "ライブラリ管理",
    startGame: "ゲーム開始",
  },
  settings: {
    title: "ゲーム設定",
    backgroundSettings: "背景設定",
    backgroundColor: "単色背景",
    backgroundImage: "画像背景",
    playerAvatars: "プレイヤーアバター",
    playerName: "プレイヤー名",
    uploadAvatar: "アバターをアップロード",
    uploadBackground: "アップロード",
    selectColor: "プリセットカラーを選択",
    imageUrl: "画像URLまたはアップロード",
    imageUrlPlaceholder: "https://example.com/image.jpg",
    colorCodeInput: "またはカラーコードを入力：",
    uploadFailed: "アップロードに失敗しました",
  },
  configManager: {
    title: "設定のインポート/エクスポート",
    exportConfig: "設定をエクスポート",
    exportToNetwork: "ネットワークにエクスポート",
    exportLocal: "ローカルにエクスポート",
    importConfig: "設定をインポート",
    importFromId: "設定IDからインポート",
    importFromFile: "ローカルファイルからインポート",
    configId: "設定ID",
    idPlaceholder: "8文字の設定IDを入力...",
    shareableId: "設定ID (共有可能)",
    exportDescription:
      "現在のカードとイベント設定をネットワークまたはローカルファイルにエクスポート",
    importDescription: "ネットワークまたはローカルファイルから設定をインポート",
    selectFile: "ファイルを選択",
    import: "インポート",
    exportSuccess: "設定のエクスポートに成功しました",
    importSuccess: "設定のインポートに成功しました",
    downloadSuccess: "設定をローカルにダウンロードしました",
    exportFailed: "エクスポートに失敗しました",
    importFailed: "インポートに失敗しました",
    localImportSuccess: "ローカル設定のインポートに成功しました",
    invalidFormat: "設定形式が無効です",
    enterConfigId: "設定IDを入力してください",
  },
  cardEditor: {
    title: "戦術カードエディタ",
    save: "保存して戻る",
    createNew: "新しいカードを設計",
    name: "名前",
    emoji: "絵文字",
    description: "説明",
    rarity: "レアリティ",
    target: "ターゲット",
    targetSelf: "自分自身",
    targetPickOne: "1人選択",
    targetRandomOther: "ランダムな相手",
    targetAllOthers: "全ての相手",
    effectType: "効果タイプ",
    moveDistance: "移動ステップ",
    moveHint: "正の数で前進、負の数で後退",
    addCard: "カードを追加",
  },
  eventEditor: {
    title: "イベントエディタ",
    save: "保存して戻る",
    createNew: "新しいイベントを追加",
    content: "イベント内容",
    color: "イベントカラー",
    target: "ターゲット",
    targetSelf: "現在のプレイヤー",
    targetAllPlayers: "全てのプレイヤー",
    targetRandomOther: "ランダムな他のプレイヤー",
    effect: "ゲーム効果",
    effectNone: "なし",
    effectMove: "移動",
    effectRestart: "リスタート",
    effectSkip: "スキップ",
    value: "値",
    valueHint: "正の数で前進、負の数で後退",
    effectLabel: "効果",
    addEvent: "イベントを追加",
    noEvents: "カスタムイベントなし",
    placeholder: "例：5つのスクワットをする",
  },
  game: {
    abort: "ミッションを中止しますか?",
    abortMessage: "ゲームを終了してもよろしいですか?",
    taskComplete: "タスク完了",
    cardUsed: "{name}は[{card}]を使用しました",
    eventAnomaly: "イベント異常",
    victory: "勝利",
    pilotWonOrbit: "パイロットP{id}が軌道を征服",
    restartGame: "ゲーム再開",
    collision: "💥 衝突！P{id} リスタート",
    skipTurn: "{name}は異常な状態です。このターンをスキップします。",
    battleInitialized:
      "戦場が初期化されました。ミッションを開始する準備ができています。",
    noEventsAlert: "まずイベントを1つ追加してください！",
    handCards: "戦術手札",
    handCardsListTitle: "手札リスト",
    noAvailableCards: "現在利用可能なタクティカルカードはありません",
    cancelSelect: "選択をキャンセル",
    selectTarget: "ターゲットを選択",
    randomizing: "ランダム選択中...",
    allTargets: "全プレイヤー",
  },
  player: "プレイヤー",
  circle: "ラップ",
  cancel: "キャンセル",
};

const fr: Translations = {
  common: {
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    add: "Ajouter",
    close: "Fermer",
    confirm: "Confirmer",
  },
  setup: {
    title: "Configuration du Party Spatial",
    numPlayers: "Nombre de joueurs",
    lapsToWin: "Tours pour gagner",
    eventDensity: "Densité d'événements",
    eventDensityLow: "Faible densité : événements rares",
    eventDensityHigh: "Haute densité : événement chaque étape",
    manageLibraries: "Gérer les bibliothèques",
    startGame: "Commencer le jeu",
  },
  settings: {
    title: "Paramètres du jeu",
    backgroundSettings: "Paramètres d'arrière-plan",
    backgroundColor: "Couleur unie",
    backgroundImage: "Image de fond",
    playerAvatars: "Avatars des joueurs",
    playerName: "Nom du joueur",
    uploadAvatar: "Télécharger l'avatar",
    uploadBackground: "Télécharger",
    selectColor: "Sélectionner une couleur prédéfinie",
    imageUrl: "URL de l'image ou télécharger",
    imageUrlPlaceholder: "https://example.com/image.jpg",
    colorCodeInput: "Ou entrez le code couleur :",
    uploadFailed: "Échec du téléchargement",
  },
  configManager: {
    title: "Import/Export de configuration",
    exportConfig: "Exporter la configuration",
    exportToNetwork: "Exporter sur le réseau",
    exportLocal: "Exporter localement",
    importConfig: "Importer la configuration",
    importFromId: "Importer depuis l'ID de configuration",
    importFromFile: "Importer depuis un fichier local",
    configId: "ID de configuration",
    idPlaceholder: "Entrez l'ID de configuration de 8 caractères...",
    shareableId: "ID de configuration (partageable)",
    exportDescription:
      "Exporter la configuration actuelle des cartes et événements vers le réseau ou un fichier local",
    importDescription:
      "Importer la configuration depuis le réseau ou un fichier local",
    selectFile: "Sélectionner un fichier",
    import: "Importer",
    exportSuccess: "Configuration exportée avec succès",
    importSuccess: "Configuration importée avec succès",
    downloadSuccess: "Configuration téléchargée localement",
    exportFailed: "Échec de l'exportation",
    importFailed: "Échec de l'importation",
    localImportSuccess: "Configuration locale importée avec succès",
    invalidFormat: "Format de configuration invalide",
    enterConfigId: "Veuillez entrer l'ID de configuration",
  },
  cardEditor: {
    title: "Éditeur de cartes tactiques",
    save: "Enregistrer et retour",
    createNew: "Concevoir une nouvelle carte",
    name: "Nom",
    emoji: "Emoji",
    description: "Description",
    rarity: "Rareté",
    target: "Cible",
    targetSelf: "Soi-même",
    targetPickOne: "Choisir un",
    targetRandomOther: "Adversaire aléatoire",
    targetAllOthers: "Tous les adversaires",
    effectType: "Type d'effet",
    moveDistance: "Étapes de mouvement",
    moveHint: "Positif pour avancer, négatif pour reculer",
    addCard: "Ajouter une carte",
  },
  eventEditor: {
    title: "Éditeur d'événements",
    save: "Enregistrer et retour",
    createNew: "Ajouter un nouvel événement",
    content: "Contenu de l'événement",
    color: "Couleur de l'événement",
    target: "Cible",
    targetSelf: "Joueur actuel",
    targetAllPlayers: "Tous les joueurs",
    targetRandomOther: "Autre joueur aléatoire",
    effect: "Effet de jeu",
    effectNone: "Aucun",
    effectMove: "Mouvement",
    effectRestart: "Redémarrage",
    effectSkip: "Sauter",
    value: "Valeur",
    valueHint: "Positif pour avancer, négatif pour reculer",
    effectLabel: "Effet",
    addEvent: "Ajouter un événement",
    noEvents: "Aucun événement personnalisé",
    placeholder: "Par exemple: Faire 5 squats",
  },
  game: {
    abort: "Abandonner la mission?",
    abortMessage: "Êtes-vous sûr de vouloir quitter le jeu?",
    taskComplete: "Tâche terminée",
    cardUsed: "{name} a utilisé [{card}]",
    eventAnomaly: "Anomalie d'événement",
    victory: "Victoire",
    pilotWonOrbit: "Le pilote P{id} a remporté l'orbite",
    restartGame: "Redémarrer le jeu",
    collision: "💥 Collision! P{id} Redémarrage",
    skipTurn: "{name} est dans un état anormal, saute ce tour.",
    battleInitialized:
      "Champ de bataille initialisé. Prêt à commencer la mission.",
    noEventsAlert: "Veuillez d'abord ajouter au moins un événement!",
    handCards: "Cartes tactiques en main",
    handCardsListTitle: "Liste des cartes en main",
    noAvailableCards: "Aucune carte tactique disponible actuellement",
    cancelSelect: "Annuler la sélection",
    selectTarget: "Sélectionner la cible",
    randomizing: "Sélection aléatoire...",
    allTargets: "Tous les joueurs",
  },
  player: "Joueur",
  circle: "Tour",
  cancel: "Annuler",
};

const languages: Record<Language, Translations> = {
  zh,
  en,
  ja,
  fr,
};

export function getTranslation(lang: Language): Translations {
  return languages[lang] || languages.en;
}

export default languages;
