/**
 * ContestPage - 模拟交易竞赛页面
 * 我的竞赛 | 公开竞赛 | 排行榜
 */
import { useState, useEffect, useCallback } from "react";
import { useStore } from "../store";
import { Trophy, Users, Clock, TrendingUp, Share2, Copy, Check, Medal, RefreshCw, Globe, Star } from "lucide-react";
import clsx from "clsx";

// ============ Types ============

interface Contestant {
  rank: number;
  username: string;
  avatar: string;
  return_pct: number;
  trades: number;
  win_rate: number;
  sharpe_ratio: number;
  last_updated: string;
}

interface Contest {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "upcoming" | "active" | "ended";
  participants: number;
  prize?: string;
  is_public: boolean;
  my_rank?: number;
  my_return_pct?: number;
}

interface ShareSnapshot {
  id: string;
  contest_id: string;
  contest_title: string;
  rank: number;
  return_pct: number;
  trades: number;
  win_rate: number;
  created_at: string;
}

// ============ Mock Data ============

const MOCK_PUBLIC_CONTESTS: Contest[] = [
  {
    id: "contest-001",
    title: "2026春季模拟交易大赛",
    description: "春季赛火热开启，争夺冠军宝座！初始资金100万，限额50名",
    start_date: "2026-04-01",
    end_date: "2026-06-30",
    status: "active",
    participants: 47,
    prize: "冠军 ¥5000",
    is_public: true,
  },
  {
    id: "contest-002",
    title: "AI量化挑战赛",
    description: "使用AI策略自动交易，考验策略有效性",
    start_date: "2026-05-01",
    end_date: "2026-07-31",
    status: "active",
    participants: 23,
    prize: "冠军 ¥3000",
    is_public: true,
  },
  {
    id: "contest-003",
    title: "新股民热身赛",
    description: "新手友好，模拟交易入门赛",
    start_date: "2026-06-01",
    end_date: "2026-06-30",
    status: "upcoming",
    participants: 0,
    is_public: true,
  },
  {
    id: "contest-004",
    title: "2026夏季精英赛",
    description: "夏季赛强势开启，高手云集",
    start_date: "2026-07-01",
    end_date: "2026-09-30",
    status: "upcoming",
    participants: 0,
    prize: "冠军 ¥8000",
    is_public: true,
  },
];

const generateLeaderboard = (): Contestant[] => {
  const names = [
    "量化猎手", "趋势追踪", "价值投资", "短线王", "长线金", "技术派",
    "基本面师", "量化新手", "稳健赢", "波段王", "涨停敢死", "价值发现",
    "成长猎手", "指数增强", "套利高手", "对冲专家", "Alpha猎手", "Beta猎手",
    "风险控制", "收益最大化"
  ];
  return names.slice(0, 15).map((name, i) => ({
    rank: i + 1,
    username: name,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    return_pct: +(Math.random() * 60 - 10).toFixed(2),
    trades: Math.floor(Math.random() * 200) + 20,
    win_rate: +(Math.random() * 40 + 50).toFixed(1),
    sharpe_ratio: +(Math.random() * 2 + 0.5).toFixed(2),
    last_updated: new Date(Date.now() - Math.random() * 300000).toISOString(),
  })).sort((a, b) => b.return_pct - a.return_pct).map((c, i) => ({ ...c, rank: i + 1 }));
};

// ============ Storage Helpers ============

const MY_CONTESTS_KEY = "my-contests";
const SHARE_SNAPSHOTS_KEY = "share-snapshots";

function getMyContests(): Contest[] {
  try {
    const stored = localStorage.getItem(MY_CONTESTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMyContests(contests: Contest[]): void {
  localStorage.setItem(MY_CONTESTS_KEY, JSON.stringify(contests));
}

function getShareSnapshots(): ShareSnapshot[] {
  try {
    const stored = localStorage.getItem(SHARE_SNAPSHOTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveShareSnapshots(snapshots: ShareSnapshot[]): void {
  localStorage.setItem(SHARE_SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

// ============ Components ============

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Medal size={20} className="text-yellow-400" />;
  if (rank === 2) return <Medal size={20} className="text-gray-300" />;
  if (rank === 3) return <Medal size={20} className="text-amber-600" />;
  return <span className="w-6 h-6 flex items-center justify-center rounded-full bg-bg-tertiary text-text-muted text-sm font-mono">{rank}</span>;
}

function ContestCard({ contest, onJoin, showJoin = false }: { contest: Contest; onJoin?: (id: string) => void; showJoin?: boolean }) {
  const statusColors = {
    upcoming: "bg-accent-warning/20 text-accent-warning",
    active: "bg-accent-success/20 text-accent-success",
    ended: "bg-text-muted/20 text-text-muted",
  };
  const statusLabels = { upcoming: "即将开始", active: "进行中", ended: "已结束" };

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color p-5 hover:border-accent-primary/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-text-primary mb-1">{contest.title}</h3>
          <p className="text-sm text-text-muted line-clamp-2">{contest.description}</p>
        </div>
        <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium ml-3 flex-shrink-0", statusColors[contest.status])}>
          {statusLabels[contest.status]}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
        <span className="flex items-center gap-1"><Clock size={14} />{contest.start_date} ~ {contest.end_date}</span>
        <span className="flex items-center gap-1"><Users size={14} />{contest.participants}人</span>
        {contest.prize && <span className="flex items-center gap-1 text-accent-warning"><Trophy size={14} />{contest.prize}</span>}
      </div>
      {contest.status === "active" && typeof contest.my_rank === "number" && (
        <div className="flex items-center gap-4 text-sm mb-4 p-3 bg-bg-tertiary rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">我的排名:</span>
            <span className="font-mono font-bold text-accent-primary">第{contest.my_rank}名</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">收益率:</span>
            <span className={clsx("font-mono font-bold", (contest.my_return_pct ?? 0) >= 0 ? "text-accent-success" : "text-accent-danger")}>
              {contest.my_return_pct != null && (contest.my_return_pct >= 0 ? "+" : "")}{contest.my_return_pct?.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
      {showJoin && contest.status !== "ended" && onJoin && (
        <button
          onClick={() => onJoin(contest.id)}
          className="w-full py-2.5 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors text-sm"
        >
          {contest.status === "upcoming" ? "立即报名" : "加入竞赛"}
        </button>
      )}
    </div>
  );
}

function LeaderboardRow({ contestant, isMe = false }: { contestant: Contestant; isMe?: boolean }) {
  return (
    <tr className={clsx("border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors", isMe && "bg-accent-primary/5")}>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <RankBadge rank={contestant.rank} />
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <img src={contestant.avatar} alt={contestant.username} className="w-8 h-8 rounded-full bg-bg-tertiary" />
          <span className={clsx("font-medium", isMe ? "text-accent-primary" : "text-text-primary")}>
            {contestant.username}
            {isMe && <span className="ml-1 text-xs text-accent-primary">(我)</span>}
          </span>
        </div>
      </td>
      <td className="py-3 px-3 text-right">
        <span className={clsx("font-mono font-bold", contestant.return_pct >= 0 ? "text-accent-success" : "text-accent-danger")}>
          {contestant.return_pct >= 0 ? "+" : ""}{contestant.return_pct.toFixed(2)}%
        </span>
      </td>
      <td className="py-3 px-3 text-right font-mono text-text-secondary">{contestant.trades}</td>
      <td className="py-3 px-3 text-right font-mono text-text-secondary">{contestant.win_rate.toFixed(1)}%</td>
      <td className="py-3 px-3 text-right font-mono text-text-secondary">{contestant.sharpe_ratio.toFixed(2)}</td>
      <td className="py-3 px-3 text-right text-text-muted text-xs">
        {new Date(contestant.last_updated).toLocaleTimeString()}
      </td>
    </tr>
  );
}

// ============ Main Component ============

export default function ContestPage() {
  const { showNotification } = useStore();
  const [activeTab, setActiveTab] = useState<"my" | "public" | "leaderboard">("my");
  const [myContests, setMyContests] = useState<Contest[]>([]);
  const [leaderboard, setLeaderboard] = useState<Contestant[]>([]);
  const [shareSnapshots, setShareSnapshots] = useState<ShareSnapshot[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [copiedSnapshotId, setCopiedSnapshotId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load from localStorage
  useEffect(() => {
    setMyContests(getMyContests());
    setShareSnapshots(getShareSnapshots());
    setLeaderboard(generateLeaderboard());
  }, []);

  // Auto-refresh leaderboard every 30 seconds
  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    const interval = setInterval(() => {
      setLeaderboard(prev => {
        // Simulate small changes
        return prev.map(c => ({
          ...c,
          return_pct: +(c.return_pct + (Math.random() - 0.5) * 0.5).toFixed(2),
          last_updated: new Date().toISOString(),
        })).sort((a, b) => b.return_pct - a.return_pct).map((c, i) => ({ ...c, rank: i + 1 }));
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleJoinContest = useCallback((contestId: string) => {
    const contest = MOCK_PUBLIC_CONTESTS.find(c => c.id === contestId);
    if (!contest) return;
    if (myContests.some(c => c.id === contestId)) {
      showNotification("info", "您已加入该竞赛");
      return;
    }
    const newContest: Contest = {
      ...contest,
      my_rank: Math.floor(Math.random() * 20) + 1,
      my_return_pct: +(Math.random() * 20 - 5).toFixed(2),
    };
    const updated = [...myContests, newContest];
    setMyContests(updated);
    saveMyContests(updated);
    showNotification("success", `成功加入「${contest.title}」`);
  }, [myContests, showNotification]);

  const handleShareSnapshot = useCallback((contestant: Contestant, contestId?: string) => {
    const snapshot: ShareSnapshot = {
      id: `snapshot-${Date.now()}`,
      contest_id: contestId || "public",
      contest_title: contestId ? myContests.find(c => c.id === contestId)?.title || "公开竞赛" : "公开排行榜",
      rank: contestant.rank,
      return_pct: contestant.return_pct,
      trades: contestant.trades,
      win_rate: contestant.win_rate,
      created_at: new Date().toISOString(),
    };
    const updated = [snapshot, ...shareSnapshots].slice(0, 20);
    setShareSnapshots(updated);
    saveShareSnapshots(updated);
    showNotification("success", "战绩快照已保存");
  }, [shareSnapshots, myContests, showNotification]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLeaderboard(generateLeaderboard());
      setIsRefreshing(false);
      showNotification("success", "排行榜已刷新");
    }, 800);
  }, [showNotification]);

  const copySnapshotLink = useCallback((snapshot: ShareSnapshot) => {
    const text = `📊 AlphaTrader战绩分享\n\n竞赛: ${snapshot.contest_title}\n🏆 排名: 第${snapshot.rank}名\n📈 收益率: ${snapshot.return_pct >= 0 ? "+" : ""}${snapshot.return_pct.toFixed(2)}%\n📊 交易次数: ${snapshot.trades}\n🎯 胜率: ${snapshot.win_rate.toFixed(1)}%\n⏰ 时间: ${new Date(snapshot.created_at).toLocaleString()}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSnapshotId(snapshot.id);
      setTimeout(() => setCopiedSnapshotId(null), 2000);
    });
  }, []);

  const myActiveContest = myContests.find(c => c.status === "active");
  const myRankings = myContests.filter(c => c.my_rank != null).map(c => ({ contest: c, rank: c.my_rank!, return_pct: c.my_return_pct! }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-warning/20 flex items-center justify-center">
          <Trophy size={20} className="text-accent-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">模拟交易竞赛</h1>
          <p className="text-text-muted text-sm">与全球投资者同台竞技，争夺排行榜冠军</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-color">
        {[
          { key: "my", label: "我的竞赛", icon: <Star size={16} /> },
          { key: "public", label: "公开竞赛", icon: <Globe size={16} /> },
          { key: "leaderboard", label: "排行榜", icon: <TrendingUp size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.key
                ? "border-accent-primary text-accent-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.key === "my" && myContests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary text-xs">
                {myContests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: My Contests */}
      {activeTab === "my" && (
        <div className="space-y-4">
          {myContests.length === 0 ? (
            <div className="text-center py-16 bg-bg-secondary rounded-xl border border-border-color">
              <Trophy size={48} className="mx-auto mb-4 text-text-muted opacity-50" />
              <p className="text-text-muted font-medium mb-2">暂无参加的竞赛</p>
              <p className="text-text-muted text-sm mb-4">加入公开竞赛开始你的竞赛之旅</p>
              <button
                onClick={() => setActiveTab("public")}
                className="px-4 py-2 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors text-sm"
              >
                浏览公开竞赛
              </button>
            </div>
          ) : (
            <>
              {/* My Rankings Summary */}
              {myRankings.length > 0 && (
                <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
                  <h3 className="text-sm font-medium text-text-muted mb-3">我的战绩</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {myRankings.map(({ contest, rank, return_pct }) => (
                      <div key={contest.id} className="bg-bg-tertiary rounded-lg p-3">
                        <div className="text-sm font-medium text-text-primary mb-1 truncate">{contest.title}</div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-text-muted text-xs">排名</span>
                            <span className="font-mono font-bold text-accent-primary">#{rank}</span>
                          </div>
                          <span className={clsx("font-mono text-sm font-bold", return_pct >= 0 ? "text-accent-success" : "text-accent-danger")}>
                            {return_pct >= 0 ? "+" : ""}{return_pct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* My Contest List */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {myContests.map(contest => (
                  <ContestCard key={contest.id} contest={contest} />
                ))}
              </div>
            </>
          )}

          {/* Share Snapshots */}
          {shareSnapshots.length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Share2 size={18} className="text-accent-secondary" />
                战绩分享记录
              </h3>
              <div className="space-y-3">
                {shareSnapshots.slice(0, 5).map(snapshot => (
                  <div key={snapshot.id} className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                    <div>
                      <div className="text-sm font-medium">{snapshot.contest_title}</div>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                        <span>第{snapshot.rank}名</span>
                        <span className={clsx(snapshot.return_pct >= 0 ? "text-accent-success" : "text-accent-danger")}>
                          {snapshot.return_pct >= 0 ? "+" : ""}{snapshot.return_pct.toFixed(2)}%
                        </span>
                        <span>{new Date(snapshot.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copySnapshotLink(snapshot)}
                      className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-muted hover:text-accent-primary"
                      title="复制分享"
                    >
                      {copiedSnapshotId === snapshot.id ? <Check size={16} className="text-accent-success" /> : <Copy size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Public Contests */}
      {activeTab === "public" && (
        <div className="space-y-4">
          {/* Filter tabs */}
          <div className="flex gap-2">
            {["all", "active", "upcoming"].map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedContestId(filter === "all" ? null : filter)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  (selectedContestId === filter || (filter === "all" && !selectedContestId))
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "bg-bg-secondary text-text-muted hover:text-text-primary"
                )}
              >
                {filter === "all" ? "全部" : filter === "active" ? "进行中" : "即将开始"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {MOCK_PUBLIC_CONTESTS
              .filter(c => !selectedContestId || c.status === selectedContestId)
              .map(contest => (
                <ContestCard
                  key={contest.id}
                  contest={contest}
                  showJoin={!myContests.some(mc => mc.id === contest.id)}
                  onJoin={handleJoinContest}
                />
              ))}
          </div>
        </div>
      )}

      {/* Tab: Leaderboard */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          {/* Leaderboard Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Clock size={14} />
              <span>每30秒自动刷新</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="bg-bg-secondary border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary"
                defaultValue="public"
              >
                <option value="public">公开排行榜</option>
                {myActiveContest && <option value={myActiveContest.id}>{myActiveContest.title}</option>}
              </select>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 bg-bg-secondary border border-border-color rounded-lg hover:border-accent-primary/50 transition-colors text-text-muted hover:text-accent-primary disabled:opacity-50"
              >
                <RefreshCw size={18} className={clsx(isRefreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Top 3 Highlight */}
          <div className="grid grid-cols-3 gap-4">
            {leaderboard.slice(0, 3).map((contestant, i) => (
              <div
                key={contestant.rank}
                className={clsx(
                  "bg-bg-secondary rounded-xl border p-4 text-center",
                  i === 0 ? "border-yellow-400/50 bg-yellow-400/5" :
                  i === 1 ? "border-gray-300/50 bg-gray-300/5" :
                  "border-amber-600/50 bg-amber-600/5"
                )}
              >
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-bg-tertiary overflow-hidden">
                  <img src={contestant.avatar} alt={contestant.username} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <RankBadge rank={contestant.rank} />
                  <span className="font-medium text-text-primary truncate">{contestant.username}</span>
                </div>
                <div className={clsx("font-mono text-xl font-bold", contestant.return_pct >= 0 ? "text-accent-success" : "text-accent-danger")}>
                  {contestant.return_pct >= 0 ? "+" : ""}{contestant.return_pct.toFixed(2)}%
                </div>
                <div className="text-xs text-text-muted mt-1">胜率 {contestant.win_rate.toFixed(1)}%</div>
                <button
                  onClick={() => handleShareSnapshot(contestant)}
                  className="mt-3 w-full py-1.5 bg-bg-tertiary hover:bg-accent-primary/10 border border-border-color hover:border-accent-primary/30 rounded-lg text-xs text-text-muted hover:text-accent-primary transition-colors flex items-center justify-center gap-1"
                >
                  <Share2 size={12} />
                  分享
                </button>
              </div>
            ))}
          </div>

          {/* Full Leaderboard Table */}
          <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted border-b border-border-color text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-3 font-medium">排名</th>
                  <th className="text-left py-3 px-3 font-medium">交易者</th>
                  <th className="text-right py-3 px-3 font-medium">收益率</th>
                  <th className="text-right py-3 px-3 font-medium">交易次数</th>
                  <th className="text-right py-3 px-3 font-medium">胜率</th>
                  <th className="text-right py-3 px-3 font-medium">夏普比率</th>
                  <th className="text-right py-3 px-3 font-medium">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((contestant) => (
                  <LeaderboardRow key={contestant.rank} contestant={contestant} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
