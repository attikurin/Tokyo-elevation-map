# 自治体データ追加ガイド

このディレクトリには、共通コア（`/app/map.html`）で使用する自治体別設定・POIデータを配置します。

## 📂 ファイル構成

```
data/
├── tokyo-index.json    # 全62自治体のメタデータ（進捗管理）
├── chiyoda.json        # 千代田区データ（サンプル）
├── <slug>.json         # 他自治体データ（順次追加）
└── README.md           # このファイル
```

## 🚀 新しい自治体を追加する手順

### ステップ 1：JSON ファイルを作成

`data/<slug>.json` として作成。slug は `tokyo-index.json` に登録された英小文字名。

例：新宿区を追加する場合 → `data/shinjuku.json`

### ステップ 2：データ構造

```json
{
  "slug": "shinjuku",
  "name": "新宿区",
  "nameEn": "Shinjuku City",
  "fullName": "東京都新宿区",
  "area": "tokubetsu",
  "center": { "lat": 35.6939, "lng": 139.7036 },
  "bounds": [[35.67, 139.67], [35.72, 139.74]],
  "initialZoom": 14,
  "elevExaggeration": 3.0,
  "theme": {
    "main": "#e91e63",
    "mainLight": "#f06292",
    "sub": "#ffc107",
    "accent": "#880e4f",
    "cream": "#fff5f7"
  },
  "icon": "🌆",
  "description": "自治体の特徴や地形の説明",
  "hazardPriority": ["flood", "duration"],
  "poi": {
    "yakusho":         [ { "name": "○○区役所", "lat": 0.0, "lng": 0.0 } ],
    "shisetsu":        [],
    "eki":             [],
    "kouen":           [],
    "jisha":           [],
    "hinanjo_shitei":  [],
    "hinanjo_kinkyu":  [],
    "hinanjo_kouiki":  [],
    "hinanjo_fukushi": []
  },
  "notes": "データ出典・注意事項"
}
```

### フィールド説明

| フィールド | 必須 | 説明 |
|---|---|---|
| `slug` | ✅ | 英小文字のID（URLに使用） |
| `name` | ✅ | 日本語自治体名 |
| `center` | ✅ | 地図初期中心座標 |
| `bounds` | 推奨 | 区域矩形 `[[南西], [北東]]` |
| `initialZoom` | 推奨 | 初期ズームレベル（12〜15） |
| `elevExaggeration` | 推奨 | 3D高さ強調倍率（1〜15） |
| `theme.main` | 推奨 | メインカラー（HEX） |
| `theme.sub` | 推奨 | アクセントカラー |
| `poi.*` | 任意 | 各カテゴリのPOI配列 |

### POIカテゴリ一覧

| key | 説明 | デフォルト表示 |
|---|---|---|
| `yakusho` | 区役所・市役所 | ON |
| `shisetsu` | 区の施設 / 市の施設 | OFF |
| `eki` | 駅 | OFF |
| `kouen` | 公園 | OFF |
| `jisha` | 寺社仏閣 | OFF |
| `hinanjo_shitei` | 指定避難所（宿泊可） | OFF |
| `hinanjo_kinkyu` | 指定緊急避難場所 | OFF |
| `hinanjo_kouiki` | 広域避難場所 | OFF |
| `hinanjo_fukushi` | 福祉避難所 | OFF |

### ステップ 3：`tokyo-index.json` を更新

該当自治体のエントリーを `status: "pending"` → `status: "core"` に変更：

```json
{"key":"新宿区","slug":"shinjuku","area":"tokubetsu","status":"core"}
```

`status` の意味：
- `done`：既存の単一HTML版で完成（府中・板橋・港・江東）
- `core`：共通コア＋JSON 方式で完成
- `pending`：未作成

### ステップ 4：アクセス確認

ブラウザで `/app/map.html?city=shinjuku` を開き、動作確認。ポータル（`/index.html`）の地図・一覧にも自動的に反映されます。

## 🎨 テーマカラーの選び方

自治体のシンボルカラーがある場合はそれを優先。ない場合は以下を目安に：

| 地形特徴 | 推奨カラー |
|---|---|
| 海・川沿い | 青系 `#0068b7` `#00aacc` |
| 山・森林 | 緑系 `#2e8b57` `#00a99d` |
| 台地・丘陵 | オレンジ系 `#ff8c69` `#ffa45b` |
| 下町・低地 | 黄系 `#e8a628` `#ffc107` |
| 文化・伝統 | 紫系 `#6a1b9a` `#8e44ad` |

## 📊 POI データ出典

- 公共施設：各自治体公式サイト
- 駅：国土数値情報「駅データ」
- 公園：各自治体公園課・公式マップ
- 寺社：各寺社公式サイト、Wikipedia等
- 避難所：各自治体防災マップ・防災アプリ
  - 必ず**制作日の最新情報**を参照し、`notes`フィールドに取得日を記載

## ⚠️ 注意事項

1. **座標の精度**：Google Maps等で正確な座標を取得。概算の場合は `notes` に明記
2. **避難所情報**：公式最新版を確認。古い情報はユーザーの安全に関わる
3. **著作権**：公開オープンデータのみ使用
4. **JSON の書式**：末尾カンマ禁止、文字列はダブルクオート

## 🔧 動作確認方法

1. ローカルで `/app/map.html?city=<slug>` を開く
2. ブラウザコンソールにエラーが出ていないか確認
3. 各POIカテゴリを順次ONにして正しく表示されるか確認
4. 3D・断面図・ハザードも確認
5. ポータル（`/index.html`）からリンクされているか確認
