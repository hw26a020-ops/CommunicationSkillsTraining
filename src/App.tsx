import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Award,
  BookOpen,
  Clock,
  ArrowRight,
  RotateCcw,
  Home,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  FileText
} from "lucide-react";

enum Screen {
  Title,
  DifficultySelect,
  Gameplay,
  Loading,
  Result,
}

interface DifficultyConfig {
  name: string;
  desc: string;
  timeLimit: number;
  minChars: number;
  scoring: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  "初級": {
    name: "初級",
    desc: "日常的で説明しやすいお題",
    timeLimit: 180,
    minChars: 0,
    scoring: "甘口",
    color: "text-emerald-600",
    borderColor: "border-emerald-200",
    bgColor: "bg-emerald-50",
  },
  "中級": {
    name: "中級",
    desc: "仕組みの理解が必要なお題",
    timeLimit: 240,
    minChars: 100,
    scoring: "普通",
    color: "text-blue-600",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
  },
  "上級": {
    name: "上級",
    desc: "抽象的・科学的なお題",
    timeLimit: 300,
    minChars: 200,
    scoring: "辛口",
    color: "text-amber-600",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
  },
  "チャレンジャー": {
    name: "チャレンジャー",
    desc: "定義や仕組みが極めて複雑なお題",
    timeLimit: 360,
    minChars: 300,
    scoring: "極辛",
    color: "text-rose-600",
    borderColor: "border-rose-200",
    bgColor: "bg-rose-50",
  },
};

interface ResultData {
  score: number;
  goodPoints: string;
  improvementPoints: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(Screen.Title);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("初級");
  const [topic, setTopic] = useState<string>("");
  const [topicDesc, setTopicDesc] = useState<string>("");
  const [explanation, setExplanation] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // カウントダウンタイマー
  useEffect(() => {
    if (screen === Screen.Gameplay && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (screen === Screen.Gameplay && timeLeft === 0) {
      // 制限時間が0になった場合、自動送信して採点へ
      handleSubmit(true);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [screen, timeLeft]);

  // ローディングメッセージのアニメーション・切り替え
  useEffect(() => {
    if (screen !== Screen.Loading) return;

    const messages = [
      "AIがあなたの説明を読み込んでいます...",
      "初めてお題を聞く人の視点で理解度を検証中...",
      "説明の「正確性」と「わかりやすさ」を分析しています...",
      "文章の「論理性」と「文章構成」をチェックしています...",
      "専門用語の多さや、具体例が適切か評価中..."
    ];
    
    setLoadingMessage(messages[0]);
    let index = 1;

    const interval = setInterval(() => {
      setLoadingMessage(messages[index % messages.length]);
      index++;
    }, 4000);

    return () => clearInterval(interval);
  }, [screen]);

  // ゲームスタート（難易度選択へ）
  const handleStartGame = () => {
    setScreen(Screen.DifficultySelect);
    setError(null);
  };

  // 難易度を選択してゲームプレイへ移行（お題生成）
  const handleSelectDifficulty = async (difficultyKey: string) => {
    setSelectedDifficulty(difficultyKey);
    setScreen(Screen.Loading);
    setLoadingMessage("AIが難易度に応じた適切なお題を生成しています...");
    setError(null);
    setShowGiveUpConfirm(false);

    try {
      const response = await fetch("/api/generate-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: difficultyKey }),
      });

      if (!response.ok) {
        throw new Error("お題の生成に失敗しました。");
      }

      const data = await response.json();
      setTopic(data.topic);
      setTopicDesc(data.description || "");
      setExplanation("");
      setTimeLeft(DIFFICULTIES[difficultyKey].timeLimit);
      setScreen(Screen.Gameplay);
    } catch (err: any) {
      console.error(err);
      setError("通信エラーが発生しました。もう一度お試しください。");
      setScreen(Screen.DifficultySelect);
    }
  };

  // 採点送信処理
  const handleSubmit = async (isTimeUp = false) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const config = DIFFICULTIES[selectedDifficulty];
    // 文字数チェック (タイムアップ時は自動送信なのでチェックをスルーする)
    if (!isTimeUp && explanation.length < config.minChars) {
      alert(`最低文字数（${config.minChars}文字）に達していません。現在の文字数: ${explanation.length}文字`);
      return;
    }

    setScreen(Screen.Loading);
    setError(null);

    try {
      const response = await fetch("/api/grade-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          difficulty: selectedDifficulty,
          topic: topic,
          explanation: explanation,
        }),
      });

      if (!response.ok) {
        throw new Error("採点に失敗しました。");
      }

      const data = await response.json();
      setResult(data);
      setScreen(Screen.Result);
    } catch (err: any) {
      console.error(err);
      setError("採点中にエラーが発生しました。お手数ですが、再度お試しください。");
      setScreen(Screen.Gameplay);
    }
  };

  // 諦める処理
  const handleGiveUp = () => {
    setShowGiveUpConfirm(true);
  };

  // 時間フォーマット (ss -> mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentConfig = DIFFICULTIES[selectedDifficulty];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased" id="app-root">
      {/* メインヘッダー */}
      <header className="border-b border-slate-200 bg-white py-4 px-6 sticky top-0 z-10 shadow-xs" id="app-header">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setScreen(Screen.Title)} id="brand-container">
            <BookOpen className="w-6 h-6 text-indigo-600" id="brand-icon" />
            <span className="font-bold text-lg tracking-tight text-slate-800" id="brand-name">
              相手に伝わる説明力トレーニング
            </span>
          </div>
          {screen === Screen.Gameplay && (
            <div className="flex items-center gap-4" id="header-status">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${currentConfig.bgColor} ${currentConfig.color}`} id="difficulty-badge">
                {selectedDifficulty}
              </span>
              <div className="flex items-center gap-1.5 text-slate-700 font-mono font-bold" id="timer-display">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* エラーメッセージ表示 */}
      {error && (
        <div className="max-w-4xl mx-auto mt-4 px-6" id="error-banner">
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">エラーが発生しました</p>
              <p className="text-xs mt-1 text-rose-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* メインコンテンツエリア */}
      <main className="max-w-4xl mx-auto py-8 px-6" id="main-content">
        <AnimatePresence mode="wait">
          {/* 5.1. タイトル画面 */}
          {screen === Screen.Title && (
            <motion.div
              key="title-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="text-center py-12 px-4"
              id="title-container"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-6 shadow-sm" id="title-icon-wrapper">
                <BookOpen className="w-8 h-8" />
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight" id="main-title">
                相手に伝わる説明力トレーニング
              </h1>
              <p className="text-lg text-slate-600 mt-4 max-w-xl mx-auto font-medium" id="sub-title">
                AIが判定する、あなたの『説明する力』
              </p>

              {/* 3ステップ解説 */}
              <div className="mt-12 bg-white rounded-2xl border border-slate-200/80 p-8 max-w-2xl mx-auto text-left shadow-sm" id="steps-card">
                <h3 className="font-bold text-slate-800 mb-6 text-center text-lg" id="steps-title">
                  トレーニングの進め方
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="steps-grid">
                  <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-slate-50 transition-colors" id="step-1">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold mb-3 shadow-xs">
                      1
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">難易度選択</h4>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      初級からチャレンジャーまで、自分のレベルに合わせた難易度を選択。
                    </p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-slate-50 transition-colors" id="step-2">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold mb-3 shadow-xs">
                      2
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">テキスト入力</h4>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      制限時間内に出されたお題を説明。最低文字数の達成が求められます。
                    </p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-slate-50 transition-colors" id="step-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold mb-3 shadow-xs">
                      3
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">AI判定・フィードバック</h4>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      AIが初心者のペルソナになり、客観的に100点満点で採点。
                    </p>
                  </div>
                </div>
              </div>

              {/* 操作部 */}
              <div className="mt-10" id="title-actions">
                <button
                  onClick={handleStartGame}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-base"
                  id="btn-start"
                >
                  ゲームを始める
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* 5.2. 難易度選択画面 */}
          {screen === Screen.DifficultySelect && (
            <motion.div
              key="difficulty-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="py-6"
              id="difficulty-select-container"
            >
              <div className="text-center mb-8" id="difficulty-header">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight" id="difficulty-title">
                  挑戦する難易度を選択してください
                </h2>
                <p className="text-slate-500 text-sm mt-2" id="difficulty-subtitle">
                  難易度によってお題の複雑さ、制限時間、AIの採点の厳しさが変化します。
                </p>
              </div>

              {/* 難易度カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto" id="difficulty-cards-grid">
                {Object.values(DIFFICULTIES).map((config) => (
                  <div
                    key={config.name}
                    className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-6 transition-all shadow-xs hover:shadow-md flex flex-col justify-between group"
                    id={`card-${config.name}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3" id={`card-header-${config.name}`}>
                        <span className={`text-lg font-bold tracking-tight ${config.color}`} id={`card-name-${config.name}`}>
                          {config.name}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bgColor} ${config.color}`} id={`card-scoring-${config.name}`}>
                          採点: {config.scoring}
                        </span>
                      </div>
                      <p className="text-slate-800 font-semibold text-sm mb-4" id={`card-desc-${config.name}`}>
                        {config.desc}
                      </p>

                      <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600" id={`card-specs-${config.name}`}>
                        <div className="flex items-center gap-2" id={`spec-time-${config.name}`}>
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>制限時間: <strong>{config.timeLimit / 60}分 ({config.timeLimit}秒)</strong></span>
                        </div>
                        <div className="flex items-center gap-2" id={`spec-length-${config.name}`}>
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span>必要最低文字数: <strong>{config.minChars === 0 ? "制限なし" : `${config.minChars}文字以上`}</strong></span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectDifficulty(config.name)}
                      className="mt-6 w-full py-3 px-4 rounded-xl bg-slate-900 group-hover:bg-indigo-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      id={`btn-select-${config.name}`}
                    >
                      この難易度で開始する
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 操作部 */}
              <div className="text-center mt-10" id="difficulty-back">
                <button
                  onClick={() => setScreen(Screen.Title)}
                  className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-semibold transition-colors py-2 px-4 rounded-lg hover:bg-slate-100"
                  id="btn-back-to-title"
                >
                  <Home className="w-4 h-4" />
                  タイトルに戻る
                </button>
              </div>
            </motion.div>
          )}

          {/* 5.3. ゲームプレイ画面 */}
          {screen === Screen.Gameplay && (
            <motion.div
              key="gameplay-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="py-4"
              id="gameplay-container"
            >
              {/* お題提示エリア */}
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs mb-8" id="topic-area">
                <span className="text-xs uppercase font-extrabold text-indigo-600 tracking-wider" id="topic-label">
                  今日のお題
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mt-2" id="topic-title">
                  {topic}
                </h2>
                {topicDesc && (selectedDifficulty === "初級" || selectedDifficulty === "中級" || selectedDifficulty === "上級") && (
                  <p className="text-sm text-slate-500 mt-3 max-w-lg mx-auto leading-relaxed" id="topic-desc">
                    {topicDesc}
                  </p>
                )}
              </div>

              {/* テキスト入力エリア */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs" id="input-area">
                <div className="flex items-center justify-between mb-3" id="input-header">
                  <label htmlFor="explanation-textarea" className="font-bold text-slate-800 text-sm flex items-center gap-1.5" id="label-textarea">
                    お題に対する説明文を入力してください
                  </label>
                  {currentConfig.minChars > 0 && (
                    <span className="text-xs text-slate-500" id="char-limit-guide">
                      最低文字数: <strong>{currentConfig.minChars}文字</strong>
                    </span>
                  )}
                </div>

                <textarea
                  id="explanation-textarea"
                  rows={8}
                  placeholder={`「${topic}」を初めて聞く人にもわかるように、正確で論理的な説明をここに書きましょう。具体例などを交えると評価が上がりやすくなります。`}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-4 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-shadow outline-hidden text-slate-800 text-base leading-relaxed resize-y"
                />

                <div className="flex items-center justify-between mt-3" id="input-footer">
                  <div className="flex items-center gap-2" id="char-counter-wrapper">
                    <span
                      className={`text-sm font-semibold px-2.5 py-0.5 rounded-md ${
                        explanation.length >= currentConfig.minChars
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-slate-50 text-slate-500 border border-slate-200"
                      }`}
                      id="char-counter"
                    >
                      {explanation.length} / {currentConfig.minChars > 0 ? `${currentConfig.minChars}文字` : "制限なし"}
                    </span>
                    {currentConfig.minChars > 0 && explanation.length < currentConfig.minChars && (
                      <span className="text-xs text-amber-600 flex items-center gap-1" id="char-warning">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        あと {currentConfig.minChars - explanation.length} 文字必要です
                      </span>
                    )}
                    {currentConfig.minChars > 0 && explanation.length >= currentConfig.minChars && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1" id="char-success">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        最低文字数を達成しました！
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* フッター操作部 */}
              <div className="mt-8" id="gameplay-actions-container">
                {showGiveUpConfirm ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center shadow-xs" id="giveup-confirm-panel">
                    <p className="text-amber-800 font-bold text-sm mb-3" id="giveup-confirm-text">
                      本当にあきらめますか？そこまで書いた内容で採点します。
                    </p>
                    <div className="flex items-center justify-center gap-4" id="giveup-confirm-buttons">
                      <button
                        onClick={() => {
                          setShowGiveUpConfirm(false);
                          handleSubmit(true); // そこまで書いた内容で採点
                        }}
                        className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-colors cursor-pointer shadow-xs"
                        id="btn-giveup-yes"
                      >
                        はい（採点する）
                      </button>
                      <button
                        onClick={() => setShowGiveUpConfirm(false)}
                        className="py-2.5 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors cursor-pointer shadow-xs"
                        id="btn-giveup-no"
                      >
                        いいえ（説明を続ける）
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4" id="gameplay-actions">
                    <button
                      onClick={handleGiveUp}
                      className="py-3 px-6 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:text-slate-800 font-semibold text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                      id="btn-giveup"
                    >
                      あきらめる
                    </button>

                    <button
                      onClick={() => handleSubmit(false)}
                      disabled={explanation.length < currentConfig.minChars}
                      className={`py-3 px-8 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 shadow-sm ${
                        explanation.length >= currentConfig.minChars
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                      id="btn-submit"
                    >
                      送信して採点する
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 5.4. 判定ローディング画面 */}
          {screen === Screen.Loading && (
            <motion.div
              key="loading-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="py-20 text-center flex flex-col items-center justify-center"
              id="loading-container"
            >
              {/* スピナー風アニメーション */}
              <div className="relative w-20 h-20 mb-8" id="spinner-wrapper">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              </div>

              <h2 className="text-xl font-bold text-slate-800 tracking-tight" id="loading-title">
                {loadingMessage}
              </h2>
              <p className="text-slate-500 text-sm mt-3 max-w-sm" id="loading-desc">
                AIがあなたの説明をもとに理解検証を行っています。これには数秒かかる場合があります。
              </p>
            </motion.div>
          )}

          {/* 5.5. 結果表示画面 */}
          {screen === Screen.Result && result && (
            <motion.div
              key="result-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="py-4"
              id="result-container"
            >
              {/* 総合スコアグラフィカル表示 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs mb-8" id="score-card">
                <span className="text-xs uppercase font-extrabold text-indigo-600 tracking-wider" id="score-label">
                  説明力の総合判定
                </span>
                
                {/* ゲージ付き円形スコア、またはシンプルな大きなサークル */}
                <div className="relative w-40 h-40 mx-auto my-6 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-full shadow-inner" id="score-circle-wrapper">
                  <div className="text-center" id="score-text-wrapper">
                    <span className="text-5xl font-black text-slate-900 tracking-tight" id="score-value">
                      {result.score}
                    </span>
                    <span className="text-xs block text-slate-500 font-semibold mt-1" id="score-max">
                      / 100 点
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold" id="result-topic-badge">
                  お題: {topic} ({selectedDifficulty})
                </div>
              </div>

              {/* フィードバックエリア（良かった点・改善点） */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="feedback-grid">
                {/* 良かった点 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col" id="good-points-card">
                  <div className="flex items-center gap-2 mb-4" id="good-points-header">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm" id="good-points-title">良かった点</h3>
                  </div>
                  <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap flex-1" id="good-points-content">
                    {result.goodPoints}
                  </div>
                </div>

                {/* 改善点 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col" id="improvement-points-card">
                  <div className="flex items-center gap-2 mb-4" id="improvement-points-header">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm" id="improvement-points-title">改善点</h3>
                  </div>
                  <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap flex-1" id="improvement-points-content">
                    {result.improvementPoints}
                  </div>
                </div>
              </div>

              {/* ユーザーが入力した文章（おさらい用） */}
              <div className="bg-slate-100 rounded-2xl border border-slate-200/60 p-6 mt-8" id="review-card">
                <h4 className="font-bold text-slate-700 text-xs mb-2 uppercase tracking-wider" id="review-title">あなたが送信した説明文</h4>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap" id="review-content">
                  {explanation || "（テキストがありません）"}
                </p>
              </div>

              {/* 操作部 */}
              <div className="flex items-center justify-center gap-4 mt-10" id="result-actions">
                <button
                  onClick={() => handleSelectDifficulty(selectedDifficulty)}
                  className="py-3 px-6 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-bold text-sm transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  id="btn-retry"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  もう一度遊ぶ
                </button>

                <button
                  onClick={() => setScreen(Screen.DifficultySelect)}
                  className="py-3 px-6 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-bold text-sm transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  id="btn-back-difficulty"
                >
                  <ArrowRight className="w-4 h-4 text-slate-500 rotate-180" />
                  難易度選択に戻る
                </button>

                <button
                  onClick={() => setScreen(Screen.Title)}
                  className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                  id="btn-home"
                >
                  <Home className="w-4 h-4" />
                  タイトルに戻る
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
