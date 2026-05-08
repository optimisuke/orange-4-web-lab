# orange-4-web-lab

ORANGE-4 (GMC-4互換) 向けのブラウザ開発環境を作るための実験リポジトリです。

## 目標

- GMC-4互換の4bit CPUシミュレーター/エミュレーター
- HEX入力とアセンブリ入力の両対応
- LED、7セグ、キー入力、音声出力のブラウザ再現
- Web Serial API を使った ORANGE-4 への書き込み
- 将来的な ORANGE-4 拡張命令対応

## 技術スタック

現時点では外部依存なしの HTML/CSS/JavaScript で開始します。UIや状態管理が大きくなったら React/Vite などへ移行します。

## ローカル起動

```bash
python3 -m http.server 5173
```

ブラウザで `http://localhost:5173` を開きます。

## メモ

元の検討メモは `docs/2026-04-27_ORANGE-4_検討メモ.md` にコピーしています。
