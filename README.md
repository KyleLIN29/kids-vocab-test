# Listen & Pick: Kids English Vocabulary Test / 单词听听看

[Open the test / 打开测试](https://kylelin29.github.io/kids-vocab-test/)

English instructions are below the Chinese ones. 中文说明在前，英文说明在后。

```text
单词听听看——给家长的使用说明
================================

这是一个给 3 岁左右宝宝用的英语词汇量测试。
宝宝不用认字：先听单词发音，再从三张图片里选出正确的那张。

本测试是自适应的：从最简单的级别开始，会做对就继续往上，可以一直测到第 24 级（全对大约 72 题）。
测试过程中不会显示英文单词。页面上方会显示当前级别和进度条。做得吃力时，连续两级没过就会结束。
测完后会给出大约认识多少词、大约达到哪个级别，以及还不熟的单词列表（给家长看）。

一、怎么打开（推荐用 iPad）
1. 把整个文件夹拷到 iPad、电脑或手机上，用浏览器打开里面的 index.html。
2. 在 iPad 的 Safari 里打开后，可以点分享按钮，再选「添加到主屏幕」，以后就能像 App 一样全屏打开。
3. 电脑上也可以直接双击 index.html（用 Safari、Chrome 或 Edge 都可以）。
4. 第一次打开需要能读到同一文件夹里的 audio 和 img，请不要只拷一个网页文件，整个文件夹要放在一起。

二、怎么测
1. 点大大的「开始」按钮（这一步也会打开声音，iPad 上必须先点一下）。
2. 每道题会自动朗读单词，屏幕上出现三张图，让宝宝点一张。
3. 听不清就再点上面的蓝色小喇叭。
4. 选对了，选中的图片会亮绿色并打勾，同时响起叮一声；选错了，点到的图片会轻轻晃一下，正确的那张会亮绿色，再把单词读一遍，然后进入下一题。计分只看第一次点的那张。
5. 测完后会看到：约认识多少词、达到哪个级别、每一级答了几题、以及「还不熟的单词」列表。
6. 可以点「再测一次」。每次题目和图片位置都会打乱。

三、文件说明
- index.html    测试页面
- words.json    词表（各级新词数量、测试用词、声音和图片路径）
- words.js      和 words.json 内容相同，是为了双击本地文件时也能读到词表
- audio/        每个测试单词的发音（美国英语）
- img/          每个测试单词的卡通图

注意：如果以后要改词表，请同时更新 words.json 和 words.js，并放入对应的声音和图片。


================================================================
Listen & Pick: Instructions for Parents (English)
================================================================

An English vocabulary test for children around 3 years old.
No reading needed: the child hears a word, then taps the matching picture out of three.

The test is adaptive. It starts at the easiest level and keeps going as long as the child does well, all the way through level 24 if needed (about 72 questions if all are correct).
The English word is never shown. The current level and a progress bar are shown at the top. The test ends after two levels in a row are not passed, or after level 24.
At the end it shows, for parents, the estimated number of words known, the approximate level, and a list of words the child hasn't learned yet.

1. How to open (iPad recommended)
   - Online: open https://kylelin29.github.io/kids-vocab-test/ in Safari or Chrome.
   - On iPad, tap the Share button and choose "Add to Home Screen" to open it full-screen like an app.
   - Offline: copy the whole folder and open index.html in a browser. Keep the audio and img folders next to index.html.

2. How to test
   1) Tap the big "开始" (Start) button. This also turns on sound, which iPad requires.
   2) Each question plays the word automatically and shows three pictures. Let the child tap one.
   3) Tap the small blue speaker to hear the word again.
   4) Correct: the picture turns green with a check mark and a chime plays.
      Wrong: the tapped picture gives a gentle shake, the correct picture turns green, and the word is read again before the next question.
      Only the first tap counts.
   5) At the end you'll see the estimated vocabulary size, the level reached, how each level went, and the words still to learn.
   6) Tap "再测一次" (Test again) to restart. Questions and picture positions are shuffled each time.

3. How the estimate works
   - Each level has 3 questions. All 3 correct moves up. 2 of 3 adds 2 more questions. 1 or fewer counts as not passed.
   - The test stops after 2 levels in a row are not passed, or after level 24. A high safety cap (120 questions) is only there so the test cannot run on forever; a child who keeps answering well is tested through all 24 levels.
   - Vocabulary = the sum over levels of (share known, corrected for guessing) × (new words in that level). 3,632 words in total across 24 levels.

4. Files
   - index.html   the test page
   - words.json   word list (new words per level, test words, audio and image paths)
   - words.js     same content as words.json, so the page also works when opened as a local file
   - audio/       pronunciation for each test word (US English)
   - img/         cartoon picture for each test word

Note: if you change the word list, update both words.json and words.js and add the matching audio and images.
```
