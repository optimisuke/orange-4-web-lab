# orange-4-web-lab

ORANGE-4 / GMC-4 互換の4bitマイコン向けに、ブラウザだけでプログラムを書き、動かし、実機へ転送するための実験用Web開発環境です。

このリポジトリは、ORANGE-4をまだ触ったことがない人でも、まずブラウザ上のエミュレーターで試し、次に実機へ送るところまで進めることを目標にしています。

## ORANGE-4とは

ORANGE-4は、ピコソフトの4bitマイコン組立てキットです。学研「大人の科学マガジン Vol.24」付録の GMC-4 と機械語レベルで互換性があり、本体だけで機械語プログラミングを学べます。

公式情報:

- ORANGE-4公式ページ: http://www.picosoft.co.jp/ORANGE-4/
- 公式マニュアル: http://www.picosoft.co.jp/ORANGE-4/download/ORANGE-4-manual.pdf
- USBシリアル接続資料: http://www.picosoft.co.jp/orange/download/usbserial.pdf

ORANGE-4本体には、7セグメントLED、7個のLED、16進キー、音出力があります。このWebアプリでは、それらをブラウザ上に再現しています。

## このアプリでできること

- アセンブリ風のソースを機械語 nibble 列へ変換
- Machine Code欄へHEX文字列を直接入力
- Machine CodeをエミュレーターRAMへ読み込み
- GMC-4互換CPUをブラウザでステップ実行
- レジスタ、RAM、PC、Flag、7セグ、LED、キー入力を表示
- Web Serial APIでORANGE-4モニターへ接続
- `e00:<HEX列>` 形式で実機RAMへ転送
- `w0` から `w3` でフラッシュメモリーへ保存

まだ実験段階です。実機への長いプログラム転送、ORANGE-4拡張命令、ラベル付きアセンブラは今後確認・追加していきます。

## 画面の見方

画面は大きく3つに分かれています。

- `Source`: アセンブリ入力欄
- `Machine Code`: 実行・転送するHEXの編集欄
- `Machine`: エミュレーターの状態表示
- `Serial Monitor`: ORANGE-4実機とのシリアル送受信ログとモニター操作

`Source` では、入力したアセンブリを `Assemble to Machine Code` でHEXのMachine Codeへ変換します。この時点ではまだエミュレーターRAMには入りません。

`Machine Code` では、アセンブル結果のHEXを確認・編集できます。アセンブリを書かず、ここへ直接HEXを書いても構いません。

Machine Code欄の下には、書き込み先が2つあります。

- `Load to Emulator RAM`: この画面のブラウザ内エミュレーターRAMへ読み込む
- `Send to ORANGE-4`: Serial Monitor経由で実機ORANGE-4へ送る。未接続ならポート選択から始める

つまり、Machine Code欄が中間地点で、そこからブラウザ画面のエミュレーターへ送るか、シリアルで実機へ送るかを選びます。

`Browser Emulator` では、読み込んだ `Machine Code` をブラウザ内のエミュレーターで動かします。`Step 1 Instruction` は1命令だけ実行、`Run Emulator` は連続実行、`Reset Emulator` はPCやレジスタを初期状態に戻します。

操作ボタンは、効き先に近い場所へ置いています。

| ボタン | 場所 | 対象 |
| --- | --- | --- |
| `Assemble to Machine Code` | `Source` | アセンブリ風ソースをHEXのMachine Codeへ変換する |
| `Load to Emulator RAM` | `Machine Code` | Machine Code欄のHEXをブラウザ内エミュレーターRAMへ読み込む |
| `Step 1 Instruction` | `Browser Emulator` | エミュレーターCPUを1命令進める |
| `Run Emulator` | `Browser Emulator` | エミュレーターCPUを連続実行する |
| `Reset Emulator` | `Browser Emulator` | エミュレーターCPU/表示を初期化する。読み込んだプログラムは残る |
| `Send to ORANGE-4` | `Machine Code` | Machine Code欄のHEXを実機モニターへ送る |

`Send to ORANGE-4` は、Machine Code欄のHEXをORANGE-4モニターへ送ります。通常は `Monitor e00:` を選びます。これはORANGE-4モニターのメモリ設定コマンド `e00:<HEX列>` として送る形式です。

`Serial Monitor` は、接続後にORANGE-4側の応答を見る場所です。RAMダンプ、実機実行、フラッシュ保存などのモニターコマンドもここから送れます。

`Browser Emulator` には以下が表示されます。

- `PC`: 次に実行するメモリアドレス
- `INST`: 直近に実行した命令
- `A/B/Y/Z`: メインレジスタ
- `A'/B'/Y'/Z'`: 退避レジスタ
- `F`: Flag。`JUMP` や `CAL` の実行条件に使われます
- `KEY`: 入力中の16進キー
- RAM `00H-5FH`: プログラムとデータを保持するメモリ

## ローカル起動

Node.js と Python が入っていれば、追加ライブラリなしで動きます。

```bash
npm run dev
```

ブラウザで開きます。

```text
http://localhost:5173
```

直接起動する場合は次でも同じです。

```bash
python3 -m http.server 5173
```

Web Serial APIを使う場合は、ChromeまたはEdge系ブラウザで開いてください。

## まずエミュレーターで試す

`Source` に次のサンプルを入力して、`Assemble to Machine Code` を押します。

```asm
; 7セグに9を表示してループ
TIA 9
AO
JUMP 00
```

`Machine Code` に次のような機械語が表示されます。

```text
8 9 1 F 0 0
```

次に `Load to Emulator RAM` を押します。これでMachine Code欄のHEXが、Machine側のRAMへ入ります。

その後、`Step 1 Instruction` を押すと1命令ずつ実行されます。`Run Emulator` を押すと連続実行します。止めるときは `Stop Emulator` を押します。

このサンプルを `Step 1 Instruction` で動かすと、次のように変化します。

| 操作 | 直近命令 | 主な変化 |
| --- | --- | --- |
| `Assemble to Machine Code` | - | `Machine Code` に `8 9 1 F 0 0` が表示される |
| `Load to Emulator RAM` | - | Machine Code欄の内容がRAMの先頭へ読み込まれる |
| `Step 1 Instruction` 1回目 | `TIA 9` | `A` が `9` になり、`PC` が `02` へ進む |
| `Step 1 Instruction` 2回目 | `AO` | 7セグに `9` が表示され、`PC` が `03` へ進む |
| `Step 1 Instruction` 3回目 | `JUMP 00` | `PC` が `00` に戻る |
| `Run Emulator` | ループ | 同じ処理を繰り返す。見た目は7セグの `9` が維持される |

## サンプル: LEDを順番に点灯

```asm
; LED 0-6 を順番に点灯
TIY 0
CAL 1
AIY 1
CIY 7
JUMP 02
TIA 9
AO
JUMP 0B
```

意味:

- `TIY 0`: Yレジスタを0にする
- `CAL 1`: LED(Y) を点灯する
- `AIY 1`: Yを1増やす
- `CIY 7`: Yが7と違うか比較する
- `JUMP 02`: Flagが1ならアドレス02へ戻る
- `TIA 9` / `AO`: 最後に7セグへ9を表示する

`Step 1 Instruction` で確認する場合:

| 操作 | 見る場所 | 期待する動き |
| --- | --- | --- |
| `Assemble to Machine Code` | `Machine Code` | `A 0 E 1 B 1 D 7 F 0 2 8 9 1 F 0 B` が表示される |
| `Load to Emulator RAM` | RAM | Machine Code欄の内容がRAMの先頭へ読み込まれる |
| `Step 1 Instruction` 1回目 | `Y`, `PC` | `Y=0`、`PC=02` |
| `Step 1 Instruction` 2回目 | LED | LED 0が点灯 |
| `Step 1 Instruction` 3回目 | `Y` | `Y=1` |
| 以降 | LED | LED 1、2、3... と順番に点灯 |
| 最後 | 7セグ | `9` が表示される |

## サンプル: キー入力を7セグに表示

```asm
; キー入力があるまで待ち、押されたキーを7セグへ表示
KA
JUMP 00
AO
JUMP 00
```

ブラウザ上の16進キーを押してから `Step 1 Instruction` または `Run Emulator` してください。キーボードでも入力できます。

このサンプルの動き:

| 状態 | 操作 | 期待する動き |
| --- | --- | --- |
| キー未入力 | `Step 1 Instruction` | `KA` はキーなしなので `F=1` になり、次の `JUMP 00` で先頭へ戻る |
| キーを押す | 画面の16進キーを押す | `KEY` に押した値が表示される |
| キー入力後 | `Step 1 Instruction` | `KA` がキー値を `A` へ入れ、`F=0` になる |
| 次の `Step 1 Instruction` | `JUMP 00` | `F=0` なのでジャンプせず、次の `AO` へ進む |
| 次の `Step 1 Instruction` | `AO` | 押したキーの値が7セグに表示される |

キーボード対応:

```text
z x c v  -> 0 1 2 3
a s d f  -> 4 5 6 7
q w e r  -> 8 9 A B
1 2 3 4  -> C D E F
```

## 入力できる形式

### アセンブリ風ソース

```asm
TIA A
AO
JUMP 00
```

現在はラベル未対応です。ジャンプ先は `JUMP 00` のように16進アドレスを直接書きます。

### Machine Code HEX

```text
8 A 1 F 0 0
```

スペースなしでも読み込めます。

```text
8A1F00
```

HEXは `Machine Code` 欄に直接入力します。`Source` 欄には入れません。

## Machineの操作例

### Step 1 Instructionで命令を追う

`Step 1 Instruction` は「今の `PC` が指している命令を1つ実行する」操作です。命令によって `PC` の進み方が違います。

| 命令 | 例 | PCの動き |
| --- | --- | --- |
| 1 nibble命令 | `AO` | 1進む |
| 2 nibble命令 | `TIA 9` | 2進む |
| 3 nibble命令 | `JUMP 00` | Flagが1なら指定アドレスへ移動 |

`PC` とRAMのハイライトを見ると、次にどの場所を実行するか分かります。

### Run Emulatorで連続実行する

`Run Emulator` は `Step 1 Instruction` を自動で繰り返します。LED点灯やキー入力待ちのようなプログラムを見るときに使います。停止するときは、ボタン表示が `Stop Emulator` になっている間にもう一度押します。

### Reset Emulatorで最初から試す

`Reset Emulator` はレジスタ、LED、7セグ、PCを初期化します。読み込んだプログラムは残るので、同じプログラムを先頭からもう一度試せます。

### Memoryの見方

RAM表示は `00H-5FH` の96 nibbleです。GMC-4互換命令では、`AM` や `MA` は `M(50+Y)` を使います。

例:

```asm
TIY 2
TIA 5
AM
```

このプログラムを3回 `Step 1 Instruction` すると、`Y=2` なので `M(50+Y)`、つまり `52H` に `5` が保存されます。RAM表示の `52` 番地が `5` になることを確認できます。

## 対応命令

基本命令:

| 命令 | 意味 |
| --- | --- |
| `KA` | キー入力をAへ |
| `AO` | Aを7セグへ表示 |
| `CH` | A/B、Y/Zを交換 |
| `CY` | A/Yを交換 |
| `AM` | AをM(50+Y)へ保存 |
| `MA` | M(50+Y)をAへ読み込み |
| `M+` | M(50+Y)+AをAへ |
| `M-` | M(50+Y)-AをAへ |
| `TIA n` | Aに4bit値nを入れる |
| `AIA n` | Aにnを加算 |
| `TIY n` | Yに4bit値nを入れる |
| `AIY n` | Yにnを加算 |
| `CIA n` | Aがnと違うか比較 |
| `CIY n` | Yがnと違うか比較 |
| `CAL n` | サブルーチン命令 |
| `JUMP nn` | Flagが1ならnnへジャンプ |

`CAL` は、PyGmc4の実装を参考に以下を入れています。

| 命令 | 意味 |
| --- | --- |
| `CAL 0` | 7セグOFF |
| `CAL 1` | LED(Y) ON |
| `CAL 2` | LED(Y) OFF |
| `CAL 4` | Aをビット反転 |
| `CAL 5` | A/B/Y/Z と A'/B'/Y'/Z' を交換 |
| `CAL 6` | Aを右シフト |
| `CAL 7` | 終了音 |
| `CAL 8` | エラー音 |
| `CAL 9` | 短音 |
| `CAL A` | 長音 |
| `CAL B` | Aに応じた音 |
| `CAL C` | タイマー |
| `CAL D` | M(5E), M(5F)をLEDへ表示 |
| `CAL E` | BCD減算 |
| `CAL F` | BCD加算 |

## 実機へ転送する

ORANGE-4にはモニター機能があり、シリアルコンソールからプログラム転送やデバッグができます。公式ページでは、PC側のアセンブル結果をシリアルコンソールへコピー&ペーストして転送する方法が案内されています。

### 必要なもの

- ORANGE-4本体
- USBシリアルケーブルまたはCP2102系USB-UARTモジュール
- ChromeまたはEdge系ブラウザ
- ORANGE-4のI/Oピンへの接続

公式ページに記載のI/Oピン:

| ピン | 信号 |
| --- | --- |
| 1 | 3.3V |
| 2 | RXD |
| 3 | TXD |
| 4 | GND |
| 5 | 5V |
| 6 | PORT1 |
| 7 | PORT2 |
| 8 | PORT3 |

配線前に必ず公式のUSBシリアル接続資料を確認してください。

### 接続手順

1. ORANGE-4とUSBシリアルを接続する
2. ブラウザで `http://localhost:5173` を開く
3. `Send to ORANGE-4` または `Connect` を押してUSBシリアルポートを選ぶ
4. ORANGE-4本体で `RST`、`D`、`RUN` の順に押してモニターを起動する
5. `Status` または `Dump RAM` を押し、ログに反応が返るか確認する

既定値:

- Baud: `115200`
- Line End: `CR`
- Format: `Monitor e00:`

### RAMへ転送

`Assemble to Machine Code` でプログラムを機械語化するか、`Machine Code` 欄へ直接HEXを入力します。その後、`Send to ORANGE-4` を押します。

デフォルトでは次の形式で送信します。

```text
e00:<HEX列><CR>
```

例:

```text
e00:891F00
```

これは「アドレス00から `8 9 1 F 0 0` を書く」という意味です。

`Format` の意味:

| Format | 送る内容 | 主な用途 |
| --- | --- | --- |
| `Monitor e00:` | `e00:891F00<CR>` | ORANGE-4モニターへRAM転送する通常形式 |
| `HEX compact` | `891F00<CR>` | 送信先が純粋なHEX列を期待する場合の確認用 |
| `HEX spaced` | `8 9 1 F 0 0<CR>` | 人が読みやすいHEX列を送る確認用 |

ORANGE-4へ実際に送る場合は、まず `Monitor e00:` を使ってください。`HEX compact`、`HEX spaced` は、別のツールやログ確認のために残している形式です。

### フラッシュへ保存

RAMへ転送後、必要に応じてページ番号を選び、`Save Flash` を押します。

内部的には次のようなコマンドを送ります。

```text
w0<CR>
```

ページ番号は `0` から `3` です。

### よく使うモニターコマンド

| UI | 送信コマンド | 意味 |
| --- | --- | --- |
| `Status` | `x` | 現在状態表示 |
| `Dump RAM` | `d` | メモリー `00-7f` 表示 |
| `List 00` | `l00` | アドレス00から逆アセンブル |
| `Reset PC/SP` | `0` | PC/SPリセット |
| `Run HW` | `g` | 実機でプログラム実行 |
| `Save Flash` | `w0`-`w3` | フラッシュへ保存 |

手入力欄から、公式モニターコマンドを直接送ることもできます。

## トラブルシュート

`Connect` を押してもポートが出ない:

- ChromeまたはEdge系ブラウザで開いているか確認
- HTTPSまたはlocalhostで開いているか確認
- USBシリアルドライバが認識されているか確認

ログに何も返らない:

- ORANGE-4側で `RST`、`D`、`RUN` を押してモニターを起動
- Baudが `115200` になっているか確認
- Line Endを `CR` にする
- RXD/TXD/GNDの接続を確認。TXD/RXDは相互接続です

転送後に動かない:

- `Dump RAM` で `e00:` の内容が入っているか確認
- `Reset PC/SP` を押してから `Run HW` を押す
- エミュレーターで同じプログラムが動くか確認
- 長いプログラムの場合、一括送信で取りこぼしていないか確認

## 開発者向け

テスト:

```bash
npm test
```

構文チェック:

```bash
npm run check
```

技術スタック:

- HTML
- CSS
- JavaScript ES Modules
- Node.js built-in test runner
- Web Serial API

主なファイル:

- `index.html`: 画面構造
- `src/app.js`: UI制御、Web Serial制御
- `src/gmc4.js`: GMC-4 CPU/IOエミュレーター、アセンブラ、HEXパーサー
- `test/gmc4.test.js`: 単体テスト
- `docs/orange-4_serial_notes.md`: シリアル調査メモ
- `docs/2026-04-27_ORANGE-4_検討メモ.md`: 元の検討メモ

## 参考

- ORANGE-4公式ページ: http://www.picosoft.co.jp/ORANGE-4/
- ORANGE-4公式マニュアル: http://www.picosoft.co.jp/ORANGE-4/download/ORANGE-4-manual.pdf
- USBシリアル接続資料: http://www.picosoft.co.jp/orange/download/usbserial.pdf
- PyGmc4: https://github.com/jay-kumogata/PyGmc4
- GMC-4 Web Minimal: https://github.com/takahashilabo/GMC-4-Web-Minimal
- ORANGE-4モニター起動記事: https://sanuki-tech.net/and-more/2022/picosoft-orange-4-monitor/
