# AtanMagicの性質の図示

TokusiNさんの魔方陣について、縦横斜めの16個の分数を `atan` した和が2πになる性質を、直角三角形で図示します。

[ツールを開く](https://tatt61880.github.io/AtanMagic/)

表示する行・列・対角線を選び、再生、1つずつの移動、スライダーで確認できます。操作方法はツール内をご覧ください。

## 出典

魔方陣のデータはTokusiNさんが公開されたものです。

- [元の投稿](https://twitter.com/toku51n/status/1533401499983749121)
- [関連する投稿](https://twitter.com/toku51n/status/1533631580450615297)
- [公開されている生データ](https://github.com/TokusiN/AtanMagic/blob/main/data.txt)

## 開発

`index.html` をブラウザーで開くと動作します。

```sh
npm ci
npm run lint
npm test
```

画面上の角度は浮動小数点で計算しています。テストではデータの条件に加え、各列の複素数積と回転数を整数演算で確認します。
