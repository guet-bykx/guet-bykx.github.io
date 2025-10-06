// about.js - 最终版（更稳健）
// 说明：
// - 定义了 lastSayHello 避免引用未定义变量
// - 使用 DOMContentLoaded/visibility guard + pjax:complete 保证在合适时机运行
// - runtimen 使用 setInterval 避免递归累积
// - fiftyonela 的外部脚本解析更稳健（防错）
// - 提供 loadExternalScriptWithFallback()，为 js-sdk-pro.min.js 等提供备用资源或静默失败机制
// - 请把 TWIKOO_ENDPOINT & TWIKOO_TOKEN 替换为真实值或保留默认占位以跳过评论计数

(function () {
    'use strict';

    // 全局状态（页面会话级）
    var lastSayHello = ''; // 防止未定义

    // 配置区（替换这些常量）
    var TWIKOO_ENDPOINT = 'https://twikoo-bnwtkeq0v-guet-bykxs-projects.vercel.app'; // 替换为实际接口或保留占位跳过
    var TWIKOO_TOKEN = '';     // 替换为实际 token
    // 备用脚本（当主 CDN 返回 502 时会尝试这些）
    var EXTERNAL_SCRIPT_FALLBACKS = {
        'js-sdk-pro.min.js': [
            '/static/js/js-sdk-pro.min.js',                // 本地优先
            'https://cdn-backup.example.com/js-sdk-pro.min.js' // 备用 CDN（示例）
        ]
    };

    /* -------------------- 公共工具函数 -------------------- */

    // 以 promise 形式加载外部脚本，支持回退列表
    function loadExternalScriptWithFallback(filename, urls) {
        return new Promise(function (resolve, reject) {
            if (!Array.isArray(urls) || urls.length === 0) {
                return reject(new Error('No URLs provided for ' + filename));
            }

            var tryIndex = 0;
            function tryLoad() {
                var url = urls[tryIndex];
                var s = document.createElement('script');
                s.src = url;
                s.async = true;
                s.onload = function () {
                    resolve(url);
                };
                s.onerror = function () {
                    tryIndex++;
                    if (tryIndex < urls.length) {
                        // small delay before next try (avoid tight loop)
                        setTimeout(tryLoad, 200);
                    } else {
                        reject(new Error('All fallbacks failed for ' + filename));
                    }
                };
                document.head.appendChild(s);
            }
            tryLoad();
        });
    }

    // 判断是否在 /about/ 页面（可按需调整）
    function isAboutPath() {
        return location.pathname.startsWith('/about/');
    }

    // 安全读取 JSON（返回 promise）
    function safeFetchJson(url) {
        return fetch(url, { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('Fetch ' + url + ' status ' + res.status);
                return res.json().catch(function (e) { throw new Error('Invalid JSON at ' + url); });
            });
    }

    /* -------------------- meuicat 对象 -------------------- */

    var meuicat = {
        comments: function () {
            // 先尝试加载本地/静态 article.json
            safeFetchJson('/article.json')
                .then(function (articleData) {
                    // articleData 解析成功，但即便没有也继续优雅降级
                    var urls = Object.keys(articleData || {});
                    // 如果没有配置 Twikoo，就跳过并打印提示
                    if (!TWIKOO_ENDPOINT || TWIKOO_ENDPOINT === '{TWIKOO_LINK}') {
                        console.info('meuicat.comments: TWIKOO 未配置，跳过远程评论计数。');
                        // 如果你希望显示每篇文章的本地评论计数逻辑，可在这里补充
                        return;
                    }

                    // 请求 Twikoo（或第三方评论接口）
                    fetch(TWIKOO_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'GET_RECENT_COMMENTS',
                            accessToken: TWIKOO_TOKEN,
                            includeReply: true,
                            pageSize: -1
                        })
                    })
                        .then(function (res) {
                            if (!res.ok) throw new Error('Twikoo status ' + res.status);
                            return res.json();
                        })
                        .then(function (payload) {
                            var data = payload && payload.data;
                            var totalComments = Array.isArray(data) ? data.length : 0;
                            var commentElements = document.querySelectorAll('.N_comments');
                            commentElements.forEach(function (el) {
                                el.innerText = totalComments + '条评论';
                            });
                        })
                        .catch(function (err) {
                            console.warn('meuicat.comments: 获取评论失败（降级）', err);
                        });
                })
                .catch(function (err) {
                    console.warn('meuicat.comments: 无法读取 /article.json，已跳过。', err);
                });
        },

        Introduction: function () {
            var pool = [
                "🤖️ 数码科技爱好者",
                "🔍 分享与热心帮助",
                "🏠 智能家居小能手",
                "🔨 设计开发一条龙",
                "📷 人文摄影的坚定者",
                "🏃 脚踏实地行动派",
                "📚 热爱阅读的书虫迷",
                "🎵 薛之谦七年热爱粉",
                "🏋️‍♀️ 坚韧不拔的健身达人",
                "🍜 走哪吃哪的美食迷",
                "🎮 Minecraft骨灰级玩家",
                "👨‍🍳 一位爱做饭的程序猿"
            ];
            var el = document.getElementById('Introduction');
            if (!el) return;
            var idx = Math.floor(Math.random() * pool.length);
            var candidate = pool[idx];
            // 保证不重复（如果全部一致则直接用）
            if (candidate === lastSayHello) {
                for (var i = 0; i < pool.length; i++) {
                    if (pool[i] !== lastSayHello) {
                        candidate = pool[i];
                        break;
                    }
                }
            }
            el.textContent = candidate;
            lastSayHello = candidate;
        },

        runtimen: (function () {
            var intervalId = null;
            // 内部实现：每秒更新一次，不使用递归 setTimeout
            function start() {
                if (intervalId) return; // 避免重复启动
                function tick() {
                    var startTime = new Date('2021/10/15 00:00:00').getTime();
                    var now = Date.now();
                    var secs = Math.round((now - startTime) / 1000);
                    var years = (secs / 78840000).toFixed(2); // 保持原来的“坤年”单位换算
                    var c = document.getElementById('run-time');
                    if (c) c.innerHTML = '已稳定运行 ' + years + ' 坤年 🏀';
                }
                tick(); // 立即更新一次
                intervalId = setInterval(tick, 1000);
            }
            return start;
        })(),

        fiftyonela: function () {
            // 51.la 的脚本通常是直接引入的 JS，这里用 fetch 获取文本并从中解析数字（保底）
            var url = 'https://v6-widget.51.la/v6/3JQeByLbvbH0rDH2/quote.js';
            fetch(url, { cache: 'no-cache' })
                .then(function (res) {
                    if (!res.ok) throw new Error('51.la status ' + res.status);
                    return res.text();
                })
                .then(function (txt) {
                    // 尝试用正则抓数字（更稳健）
                    // 抽出所有连续数字或带千分位的数字
                    var matches = txt.match(/[\d,]{1,}/g) || [];
                    // 清洗并取前 5 个（视具体脚本而定）
                    var nums = matches.map(function (s) { return s.replace(/,/g, ''); }).slice(0, 5);
                    var statisticEl = document.getElementById('statistic');
                    if (!statisticEl) return;
                    var title = ['今日人数', '今日访问', '昨日人数', '昨日访问', '本月访问'];
                    statisticEl.innerHTML = ''; // 清空再填
                    for (var i = 0; i < nums.length && i < title.length; i++) {
                        statisticEl.innerHTML += '<div><span class="tips">' + title[i] + '</span><span id="' + title[i] + '">' + (nums[i] || '0') + '</span></div>';
                    }
                    // 最近活跃放到 .T-box（如果存在）
                    var TBoxEl = document.querySelector('.T-box');
                    if (TBoxEl && nums.length > 0) {
                        TBoxEl.innerHTML = '最近活跃：' + nums[0] + '&ensp;|&ensp;' + (TBoxEl.innerHTML || '');
                    }
                })
                .catch(function (err) {
                    console.warn('meuicat.fiftyonela: 无法获取或解析 51.la 数据，已忽略。', err);
                });
        }
    };

    /* -------------------- whenDOMReady 控制 -------------------- */

    function whenDOMReady() {
        if (!isAboutPath()) return;
        // 容错执行，保证任何一个方法抛错不会阻塞其他方法
        try { meuicat.comments && meuicat.comments(); } catch (e) { console.error('comments error', e); }
        try { meuicat.Introduction && meuicat.Introduction(); } catch (e) { console.error('Introduction error', e); }
        try { meuicat.runtimen && meuicat.runtimen(); } catch (e) { console.error('runtimen error', e); }
        try { meuicat.fiftyonela && meuicat.fiftyonela(); } catch (e) { console.error('fiftyonela error', e); }
    }

    // 事件绑定：DOMContentLoaded + pjax 完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', whenDOMReady);
    } else {
        // 已就绪
        setTimeout(whenDOMReady, 0);
    }
    // pjax 回调（如果你的站点使用 pjax）
    document.addEventListener('pjax:complete', whenDOMReady);

    /* -------------------- 外部脚本的智能加载（示例） -------------------- */

    // 如果你有外部脚本经常 502（例如 js-sdk-pro.min.js），把它在这里以回退数组形式注册
    // 然后在站点初始化时调用 loadExternalScriptWithFallback('js-sdk-pro.min.js', EXTERNAL_SCRIPT_FALLBACKS['js-sdk-pro.min.js'])
    // 下面只是示例：若不需要可注释掉
    (function tryLoadProblematicScripts() {
        var key = 'js-sdk-pro.min.js';
        if (!EXTERNAL_SCRIPT_FALLBACKS[key]) return;
        loadExternalScriptWithFallback(key, EXTERNAL_SCRIPT_FALLBACKS[key])
            .then(function (url) {
                console.info('Loaded external script for', key, 'from', url);
            })
            .catch(function (err) {
                console.warn('Unable to load external script', key, ', continuing without it.', err);
            });
    })();

})();
