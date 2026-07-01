import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// オフライン時のお題バンク
const FALLBACK_TOPICS: Record<string, Array<{ topic: string; description: string }>> = {
  "初級": [
    { topic: "傘", description: "雨の日に差して濡れないようにするための生活必需品。" },
    { topic: "時計", description: "今が何時何分かを確認して、生活のリズムを守る道具。" },
    { topic: "箸", description: "日本の食事で、食べ物をつまんだり混ぜたりするために使う2本の棒。" },
    { topic: "信号機", description: "道路で、赤青黄の光によって交通の安全をコントロールする設備。" },
    { topic: "自転車", description: "ペダルを足で漕ぎ、2つの車輪を回転させて移動する乗り物。" },
    { topic: "はさみ", description: "2枚の刃を交差させ、物を挟んで切る道具。" },
    { topic: "鏡", description: "光を反射させて、自分の姿や周囲の景色を映し出すガラス板。" },
    { topic: "消しゴム", description: "鉛筆などで書いた文字や絵を、摩擦によってこすり消す文房具。" }
  ],
  "中級": [
    { topic: "冷蔵庫", description: "電気の力で内部を冷やし、食材の鮮度を長く保つ家電。" },
    { topic: "電子レンジ", description: "目に見えない電磁波を当てて、食品の水分を直接温める家電。" },
    { topic: "エレベーター", description: "ワイヤーとモーターを使い、人や荷物を高い階へ垂直に運ぶカゴ状の乗り物。" },
    { topic: "自動販売機", description: "お金を入れると、無人で瞬時に飲み物や食べ物を提供する機械。" },
    { topic: "エアコン", description: "室内の空気を吸い込み、冷やしたり温めたりして温度を調整する空調設備。" },
    { topic: "バーコード", description: "太さの異なる黒い縦線と白い隙間の並びで、商品の情報を機械に読み取らせる仕組み。" },
    { topic: "スマートフォン", description: "インターネット、通話、カメラ、様々な機能を手のひらサイズに集約した携帯用多機能コンピュータ。" },
    { topic: "電子マネー", description: "現金をやり取りせず、カードやスマホのデータを介してお金を支払う決済手段。" }
  ],
  "上級": [
    { topic: "Wi-Fi", description: "ケーブルをつながずに、電波を使ってスマートフォンやPCをインターネットに接続する技術。" },
    { topic: "重力", description: "地球などの質量があるすべての物体が、他の物体を自分の方へと引き寄せる目に見えない力。" },
    { topic: "光合成", description: "植物が日光のエネルギーを浴びて、水と二酸化炭素から酸素と栄養を作る生命活動。" },
    { topic: "インフレ", description: "市場のお金の量が増え、モノやサービスの価値が上がり、お金自体の価値が下がり続ける現象。" },
    { topic: "著作権", description: "本、音楽、絵画などを創作した人が、その作品を勝手にコピー・販売されないように守る法律上の権利。" },
    { topic: "インターネット", description: "世界中のコンピュータやサーバーが相互に網の目のように繋がり、情報を一瞬で送受信できる巨大な通信網。" },
    { topic: "クラウド", description: "手元の機器にデータを保存せず、ネットの向こう側にある共有サーバーを必要な分だけ借りて使うサービス形態。" },
    { topic: "ブラックホール", description: "非常に質量が重く、光さえも吸い込まれて脱出できない、宇宙空間にある極めて重力が強い天体。" }
  ],
  "チャレンジャー": [
    { topic: "量子力学", description: "極めて小さな分子、原子、素粒子などのミクロな世界における、特有の不思議な物理現象を扱う学問。" },
    { topic: "ブロックチェーン", description: "ネットワーク上の全員で取引データを監視・共有し、データの改ざんを不可能にする分散型の記録技術。" },
    { topic: "メタバース", description: "インターネット上に構築された、アバターを使って多人数が交流・活動できる3次元の仮想空間。" },
    { topic: "遺伝子組み換え", description: "遺伝子やDNAを人工的に操作・結合し、新しい性質や機能を持つ生物を創り出す先端バイオ技術。" },
    { topic: "超弦理論", description: "宇宙のすべての最小単位は点ではなく、極小の「振動するひも（弦）」であると説明する超最先端の物理学説。" },
    { topic: "半導体", description: "電気をよく通す金属と、電気を通さない絶縁体の中間の性質を持ち、デジタル機器の電流・情報を精密に制御する素材や素子。" },
    { topic: "人工知能 (AI)", description: "人間の思考や学習、判断などの知的プロセスを、高度なコンピュータプログラムと大量のデータ解析によって再現する技術。" },
    { topic: "核融合", description: "太陽と同じ原理で、軽い原子の核同士がくっついて極めて巨大なエネルギーを生み出す、次世代のクリーンな発電技術。" }
  ]
};

// オフライン採点エンジン
function calculateFallbackGrade(difficulty: string, topic: string, explanation: string) {
  const length = explanation.trim().length;

  if (length < 5) {
    return {
      score: Math.max(0, Math.min(10, length * 2)),
      goodPoints: "説明の入力が確認できませんでした、または内容が極端に短いです。(オフライン簡易判定)",
      improvementPoints: "まずは「あきらめる」場合でも、思ったことや知っているキーワードをいくつか書き出してから送信してみてください。一言でも書くことで、説明への第一歩になります。"
    };
  }

  // 難易度別基準
  let targetLen = 50;
  let lenScoreMax = 30;
  if (difficulty === "初級") targetLen = 30;
  else if (difficulty === "中級") { targetLen = 100; lenScoreMax = 40; }
  else if (difficulty === "上級") { targetLen = 200; lenScoreMax = 40; }
  else if (difficulty === "チャレンジャー") { targetLen = 300; lenScoreMax = 45; }

  // 1. 文字数スコア (Max: lenScoreMax)
  const lenRatio = Math.min(1, length / targetLen);
  let lenScore = Math.floor(lenRatio * lenScoreMax);
  if (length > targetLen) {
    lenScore += Math.min(5, Math.floor((length - targetLen) / 20));
  }

  // 2. キーワード・構成スコア (Max: 100 - lenScoreMax)
  let keyScore = 20; // 基礎点
  const matchedKeywords: string[] = [];
  
  const keywordMap: Record<string, string[]> = {
    "傘": ["雨", "濡れ", "差す", "防ぐ", "水", "上", "開く", "骨"],
    "時計": ["時間", "時刻", "針", "分", "秒", "数字", "今", "計測"],
    "箸": ["食べ", "食事", "つまむ", "２本", "木", "手", "持つ", "和食"],
    "信号機": ["赤", "青", "黄", "道路", "交通", "安全", "車", "歩行者", "ライト", "交差点"],
    "自転車": ["ペダル", "漕ぐ", "２輪", "車輪", "移動", "乗り物", "足", "チェーン", "ハンドル"],
    "はさみ": ["切る", "刃", "交差", "挟む", "紙", "道具", "金属"],
    "鏡": ["映", "光", "反射", "自分", "姿", "顔", "左右", "ガラス"],
    "消しゴム": ["消す", "鉛筆", "摩擦", "文字", "こする", "文房具", "ゴム", "修正"],
    "冷蔵庫": ["冷やす", "食材", "鮮度", "電気", "保存", "庫内", "冷気", "凍る", "冷凍"],
    "電子レンジ": ["電磁波", "温める", "水分", "食品", "加熱", "マイクロ波", "振動", "摩擦熱"],
    "エレベーター": ["垂直", "運ぶ", "ワイヤー", "上下", "カゴ", "階", "建物", "昇降"],
    "自動販売機": ["無人", "お金", "購入", "飲料", "提供", "ジュース", "コイン", "お札", "ボタン"],
    "エアコン": ["部屋", "空気", "冷房", "暖房", "温度", "熱", "調節", "室外機", "冷媒"],
    "バーコード": ["黒い線", "機械", "読み取り", "レジ", "数字", "製品", "スキャン", "価格", "情報"],
    "スマートフォン": ["携帯", "インターネット", "アプリ", "電話", "画面", "機能", "多機能", "モバイル"],
    "電子マネー": ["決済", "現金", "カード", "支払", "データ", "ピッと", "キャッシュレス", "残高"],
    "Wi-Fi": ["無線", "電波", "インターネット", "接続", "ＬＡＮ", "ケーブル", "機器", "ルーター"],
    "重力": ["地球", "引き寄せる", "質量", "引っ張る", "引力", "落ちる", "宇宙"],
    "光合成": ["植物", "太陽", "酸素", "二酸化炭素", "栄養", "光", "葉緑体", "水", "デンプン"],
    "インフレ": ["物価", "お金の価値", "上昇", "サービス", "下落", "インフレーション", "価格", "貨幣"],
    "著作権": ["作品", "作者", "権利", "コピー", "無断", "守る", "法律", "著作物", "クリエイター"],
    "インターネット": ["世界中", "ネットワーク", "接続", "通信", "パソコン", "情報", "ウェブ", "サーバー"],
    "クラウド": ["サーバー", "インターネット", "保存", "ネット上", "共有", "データ", "オンライン"],
    "ブラックホール": ["宇宙", "重力", "光", "吸い込まれる", "高密度", "アインシュタイン", "恒星"],
    "量子力学": ["ミクロ", "分子", "原子", "素粒子", "物理", "重ね合わせ", "観測", "波動", "粒子"],
    "ブロックチェーン": ["分散", "台帳", "暗号", "改ざん", "取引", "データ", "セキュリティ", "非中央集権"],
    "メタバース": ["仮想空間", "３次元", "アバター", "コミュニケーション", "交流", "インターネット", "ＶＲ"],
    "遺伝子組み換え": ["遺伝子", "ＤＮＡ", "細胞", "品種改良", "作物", "性質", "組み込み", "安全"],
    "超弦理論": ["宇宙", "最小単位", "ひも", "弦", "振動", "物理学", "次元", "素粒子"],
    "半導体": ["電気", "中間", "物質", "チップ", "コンピュータ", "シリコン", "回路", "集積"],
    "人工知能 (AI)": ["コンピュータ", "学習", "判断", "データ", "知能", "機械学習", "脳", "自動"],
    "核融合": ["水素", "ヘリウム", "太陽", "エネルギー", "合体", "クリーン", "次世代", "超高温"]
  };

  const keywords = keywordMap[topic] || [];
  keywords.forEach(kw => {
    if (explanation.includes(kw)) {
      matchedKeywords.push(kw);
    }
  });

  const kwScore = Math.min(30, matchedKeywords.length * 5);
  keyScore += kwScore;

  // 構成要素チェック
  const structures = [
    { key: "例えば", score: 5, label: "「例えば」を使った具体例の提示" },
    { key: "とは", score: 5, label: "「〜とは」による定義付け" },
    { key: "なぜなら", score: 5, label: "理由の説明" },
    { key: "です", score: 3, label: "丁寧な結び表現" },
    { key: "ます", score: 3, label: "丁寧な結び表現" }
  ];

  structures.forEach(st => {
    if (explanation.includes(st.key)) {
      keyScore += st.score;
    }
  });

  let score = lenScore + keyScore;

  if (difficulty === "初級") {
    score = Math.floor(score * 1.2);
  } else if (difficulty === "中級") {
    // 標準
  } else if (difficulty === "上級") {
    if (length < targetLen) {
      score = Math.floor(score * 0.8);
    } else {
      score = Math.floor(score * 0.95);
    }
  } else if (difficulty === "チャレンジャー") {
    if (length < targetLen) {
      score = Math.floor(score * 0.7);
    } else {
      score = Math.floor(score * 0.85);
    }
  }

  score = Math.max(12, Math.min(98, score));

  let goodPoints = "";
  let improvementPoints = "";

  if (score >= 80) {
    goodPoints = `素晴らしい説明力です！難易度「${difficulty}」のお題「${topic}」に対し、要点を的確に整理して説明されています。`;
    if (matchedKeywords.length > 0) {
      goodPoints += `特に「${matchedKeywords.slice(0, 3).join("」「")}」といった electoral なワードを用いて解説できている点、および丁寧な文章構成が素晴らしいです。`;
    }
    improvementPoints = "すでに非常に分かりやすい説明となっています。さらなるステップアップとして、初めてこの言葉を聞く子供や高齢者など、対象に合わせた比喩表現（メタファー）を取り入れると、唯一無二の洗練された説明になります。";
  } else if (score >= 50) {
    goodPoints = `お題「${topic}」の基本事項をしっかりと記述できています。`;
    if (matchedKeywords.length > 0) {
      goodPoints += `「${matchedKeywords.slice(0, 3).join("」「")}」といった主要キーワードが盛り込まれており、伝えたい核心部分は伝わってきます。`;
    } else {
      goodPoints += `必要な文字数を満たしており、一生懸命に説明しようとする姿勢が文章全体から伝わります。`;
    }
    
    improvementPoints = `より高い得点を目指すためのアドバイス：\n`;
    if (length < targetLen) {
      improvementPoints += `1. 難易度${difficulty}の目標文字数は${targetLen}文字ですが、今回は${length}文字と少し短めです。詳細な説明や仕組みをもう少し書き加えましょう。\n`;
    }
    if (matchedKeywords.length < 2) {
      improvementPoints += `2. 「${topic}」を説明する上で重要となる本質的な言葉（例：構成部品や主な目的、動作原理）をさらに掘り下げてみてください。\n`;
    }
    if (!explanation.includes("例えば")) {
      improvementPoints += `3. 「例えば、〜」から始まる具体的な日常のシチュエーションや使用例を追加すると、読み手がイメージしやすくなり、さらに理解度が深まります。`;
    }
  } else {
    goodPoints = `「${topic}」についての説明を言葉にしようと挑戦した点が素晴らしいです。`;
    if (length >= 15) {
      goodPoints += `最後まであきらめずに自分の言葉でアウトプットされています。`;
    }
    
    improvementPoints = `伝わりやすさを劇的に向上させるポイント：\n`;
    if (length < targetLen) {
      improvementPoints += `1. 文章量が${length}文字と不足しています（目標：${targetLen}文字）。言葉を補い、詳細な特徴を述べましょう。\n`;
    }
    improvementPoints += `2. 「これはいわば、〇〇のようなものです」という直感的な比喩や、「なぜなら〇〇だからです」という理由説明のパターンに文章を当てはめて書いてみましょう。\n`;
    improvementPoints += `3. 一度にすべてを説明しようとせず、「①何なのか、②どう使うのか（どういう仕組みか）、③何の役に立つのか」と順番を分けて箇条書き風に整理するのもおすすめです。`;
  }

  goodPoints += " (オフライン簡易評価モード)";

  return {
    score,
    goodPoints,
    improvementPoints
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Keyの取得
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // お題生成 API
  app.post("/api/generate-topic", async (req, res) => {
    const { difficulty } = req.body;
    
    if (!difficulty) {
      return res.status(400).json({ error: "難易度（difficulty）が指定されていません。" });
    }

    try {
      let difficultyDesc = "";
      let forbiddenExamples = "";
      if (difficulty === "初級") {
        difficultyDesc = "日常的に誰もが頻繁に使い、直感的に理解・説明しやすい名詞。";
        forbiddenExamples = "信号機、トランプ、自転車、はさみ、傘、靴、時計";
      } else if (difficulty === "中級") {
        difficultyDesc = "日常的に使うまたは目にするが、その裏側にある仕組みや技術・原理を説明する必要があるもの。";
        forbiddenExamples = "電子レンジ、エレベーター、自動販売機、冷蔵庫、エアコン、スマートフォン、QRコード";
      } else if (difficulty === "上級") {
        difficultyDesc = "抽象的な概念、社会的な仕組み、あるいは目に見えない科学的現象・ルール。";
        forbiddenExamples = "Wi-Fi、重力、光合成、インフレ、デフレ、著作権、インターネット、ブラックホール";
      } else if (difficulty === "チャレンジャー") {
        difficultyDesc = "定義や仕組みが極めて複雑で、高度な専門知識を必要とする難解な技術、学問、または最新の概念。";
        forbiddenExamples = "量子力学、ブロックチェーン、メタバース、遺伝子組み換え、人工知能、超弦理論、半導体";
      } else {
        difficultyDesc = "日常的なもの";
      }

      const prompt = `あなたは「相手に伝わる説明力」を鍛えるゲームの、高度なお題自動生成システムです。
難易度は「${difficulty}」です。

お題の選定基準:
${difficultyDesc}

【重要：お題のランダム性と多様性の確保】
お題が毎回同じパターンに偏らないように、以下の手順に従って生成してください：
1. まず、次のジャンルリストから1つをランダムに選定してください：[科学技術, 日用品, インフラ・社会制度, 自然科学, ビジネス・経済, デジタルIT, 文化・アート, 心理・脳科学]。
2. 選定したジャンルの中で、難易度「${difficulty}」に合致する「誰もが名前は聞いたことがあるが、いざその仕組みや概念を他人に1から説明しようとすると非常に頭を使うもの」を1つだけ選定してください。
3. 以下の単語は「過去の出題例」のため、【絶対に】出力しないでください（部分一致も含む完全禁止）：
   [${forbiddenExamples}]

お題の文字数は短くシンプルなキーワードにしてください（例: "電子レンジ"や"重力"のようなスタイルの、1〜2語の名詞・キーワード）。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: {
                type: Type.STRING,
                description: "生成されたお題のワード。極めてシンプルで短い単語（例：電子レンジ、重力、Wi-Fiなど）。"
              },
              description: {
                type: Type.STRING,
                description: "お題に関する簡単な一言概要（1行程度）。"
              }
            },
            required: ["topic", "description"]
          }
        }
      });

      const data = JSON.parse(response.text?.trim() || "{}");
      res.json(data);
    } catch (error: any) {
      console.warn("Generate Topic Error (Falling back to local topic bank):", error.message || error);
      // オフライン・エラー回避用にお題をランダムに選択して返す
      const list = FALLBACK_TOPICS[difficulty] || FALLBACK_TOPICS["初級"];
      const selected = list[Math.floor(Math.random() * list.length)];
      res.json({
        topic: selected.topic,
        description: selected.description + " (オフラインモード)"
      });
    }
  });

  // 採点 API
  app.post("/api/grade-explanation", async (req, res) => {
    const { difficulty, topic, explanation } = req.body;

    if (!difficulty || !topic || explanation === undefined || explanation === null) {
      return res.status(400).json({ error: "必要なパラメータが不足しています。" });
    }

    try {
      let criteriaPrompt = "";
      let minLength = 0;
      if (difficulty === "初級") {
        minLength = 0;
        criteriaPrompt = "採点基準は「非常に甘い」です。多少の言葉足らずや論理の飛躍があっても、あなたが前後の文脈から好意的に解釈し、100文字に満たなくても、説明の核心を突いていれば高得点（80〜100点）を惜しみなく与えてください。初めて聞く人として「なんとなく言いたいことが分かった」レベルで十分です。";
      } else if (difficulty === "中級") {
        minLength = 100;
        criteriaPrompt = "採点基準は「標準的」です。一般的な大人が理解できるレベルの客観性とわかりやすさを基準に採点します。100文字以上の説明を求めています（もし極端に短い場合は減点してください）。初めて聞く人として「仕組みや役割がすっきり理解できた」と思えるかどうかで採点してください。";
      } else if (difficulty === "上級") {
        minLength = 200;
        criteriaPrompt = "採点基準は「厳しい」です。論理的な矛盾、説明不足、曖昧な表現、事実誤認を厳しくチェックし、減点対象とします。200文字以上の丁寧な説明を求めています。初めて聞く人として「論理的な筋道が通っており、疑問が残らない完璧な説明である」と納得できるかどうかで採点してください。";
      } else if (difficulty === "チャレンジャー") {
        minLength = 300;
        criteriaPrompt = "採点基準は「極めて厳しい」です。専門知識が必要な難解なお題に対して、専門用語を一切使わないか、または一般的な分かりやすい言葉に徹底的に翻訳して誰にでも理解できるように説明できているか、構成に一切の妥協がないかを厳密に審査します。300文字以上の説明を求めます。最高の基準を全て完璧に満たさなければ、高得点（80点以上）は絶対に獲得できません。容赦なく客観的に採点してください。";
      }

      const systemInstruction = `あなたは「初めてお題について聞く、何の予備知識もない一般人」になりきるペルソナAIです。
プレイヤーが入力した説明文を読み、「初めてその言葉を聞くあなた」が理解できたかどうかを判定・評価します。

評価の観点:
1. 正確性: 説明内容が事実として正しいか
2. わかりやすさ: 表現が平易で、直感的に理解しやすいか
3. 論理性: 説明の筋道が通っているか
4. 専門用語の少なさ: 難しい言葉や専門用語を避けているか（あるいは適切に補足されているか）
5. 具体例の有無: 理解を助ける具体例が提示されているか
6. 文章構成: 導入・本論・結論などの構成が整っているか

上記の観点から、難易度の条件に基づいて厳密に【全体の総合点（100点満点）】を採点してください。
また、採点結果と共に、プレイヤーの文章に対する「良かった点」と「改善点」を具体的に日本語で作成してください。`;

      const userPrompt = `お題: ${topic}
難易度: ${difficulty}
プレイヤーによる説明文:
"""
${explanation}
"""

難易度別特別ルール:
- 文字数制限について: ${difficulty}の最低文字数は${minLength === 0 ? "制限なし" : minLength + "文字以上"}です。今回の入力文字数は${explanation.length}文字です。
- 説明文が極端に短い場合、または完全に空（白紙）の場合は、強制的に0点〜10点とし、「良かった点」には「説明が入力されていません」などの現状の指摘を、「改善点」には「まずは思いつく内容から説明を書きましょう」などのアドバイスを記載してください。
- 採点難易度の厳しさ: ${criteriaPrompt}

必ず全体の総合点（100点満点）を出し、「良かった点」「改善点」を分かりやすく日本語でJSONフォーマットで回答してください。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: {
                type: Type.INTEGER,
                description: "100点満点中の総合スコア（整数値、0〜100）"
              },
              goodPoints: {
                type: Type.STRING,
                description: "説明の中で特に伝わりやすかった部分や、工夫が感じられた点を具体的に説明した「良かった点」のテキスト。"
              },
              improvementPoints: {
                type: Type.STRING,
                description: "より伝わる説明にするために、不足している情報や書き直すべき表現を具体的にアドバイスした「改善点」のテキスト。"
              }
            },
            required: ["score", "goodPoints", "improvementPoints"]
          }
        }
      });

      const data = JSON.parse(response.text?.trim() || "{}");
      res.json(data);
    } catch (error: any) {
      console.warn("Grade Explanation Error (Falling back to local grader):", error.message || error);
      // オフライン・エラー回避用にローカル簡易採点を実行
      const fallbackResult = calculateFallbackGrade(difficulty, topic, explanation);
      res.json(fallbackResult);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
