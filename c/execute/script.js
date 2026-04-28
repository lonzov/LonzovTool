const TextConverterApp = (function () {
    const inputElement = document.getElementById('inputText');
    const outputElement = document.getElementById('outputText');
    const statusElement = document.getElementById('statusMessage');
    const convertBtn = document.getElementById('convertBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const backButton = document.getElementById('backButton');
    let clearClickCount = 0;
    let clearClickTimer = null;

    // 显示提示 'error', 'warning', 'success', 'default'
    function showStatus(message, type = 'default') {
        statusElement.textContent = message;
        statusElement.className = 'status-message';
        if (type) {
            statusElement.classList.add(type);
        }
    }

    function getInputText() {
        return inputElement.value;
    }

    function setOutputText(text) {
        outputElement.value = text;
    }

    function clearAll() {
        inputElement.value = '';
        setOutputText('');
        showStatus('已清空', 'warning');
        inputElement.focus();
        clearClickCount = 0;
        if (clearClickTimer) {
            clearTimeout(clearClickTimer);
            clearClickTimer = null;
        }
    }

    function handleClearClick() {
        clearClickCount++;
        if (clearClickCount === 1) {
            showStatus('双击确认清空', 'error');
            clearClickTimer = setTimeout(() => {
                clearClickCount = 0;
                clearClickTimer = null;
            }, 800);
        } else if (clearClickCount === 2) {
            clearTimeout(clearClickTimer);
            clearClickTimer = null;
            clearClickCount = 0;
            clearAll();
        }
    }

    async function copyToClipboard() {
        const textToCopy = outputElement.value;
        if (!textToCopy) {
            showStatus('请先转换再复制', 'warning');
            return;
        }
        try {
            await navigator.clipboard.writeText(textToCopy);
            showStatus('复制成功！', 'success');
            outputElement.blur();
            return;
        } catch (err) {
            console.warn('Clipboard API 失败:', err);
        }
        try {
            outputElement.select();
            outputElement.setSelectionRange(0, 999999);
            const successful = document.execCommand('copy');
            if (successful) {
                showStatus('复制成功！', 'success');
            } else {
                throw new Error('execCommand 返回 false');
            }
        } catch (err) {
            console.error('execCommand 复制失败:', err);
            showStatus('复制失败: ' + (err.message || '未知错误'), 'error');
        } finally {
            outputElement.blur();
        }
    }

    // ============================================================
    //  Tokenizer - 将命令字符串拆分为 token 流
    // ============================================================

    class CompileError extends Error {
        constructor(message, pos) {
            super(message);
            this.pos = pos;
        }
    }

    /**
     * 将命令字符串拆分为 token 列表
     * 保留引号内的空格，将坐标符号 ~^ 与数字合并
     */
    function tokenize(command) {
        const tokens = [];
        let i = 0;
        const len = command.length;

        while (i < len) {
            // 跳过空格
            if (command[i] === ' ' || command[i] === '\t') {
                i++;
                continue;
            }

            const start = i;

            // 引号字符串
            if (command[i] === '"' || command[i] === "'") {
                const quote = command[i];
                i++;
                while (i < len && command[i] !== quote) {
                    if (command[i] === '\\') i++; // 跳过转义
                    i++;
                }
                if (i < len) i++; // 跳过闭合引号
                tokens.push({ token: command.slice(start, i), type: 'String', start, end: i });
                continue;
            }

            // 坐标符号开头: ~ 或 ^
            if (command[i] === '~' || command[i] === '^') {
                i++;
                // 读取后面的数字（可能带符号和小数点）
                if (i < len && (command[i] === '+' || command[i] === '-')) i++;
                while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++;
                tokens.push({ token: command.slice(start, i), type: 'Coordinate', start, end: i });
                continue;
            }

            // 数字（可能带符号）或 范围值 如 1..10
            if ((command[i] >= '0' && command[i] <= '9') ||
                ((command[i] === '-' || command[i] === '+') && i + 1 < len && command[i + 1] >= '0' && command[i + 1] <= '9')) {
                // 读数字部分
                if (command[i] === '+' || command[i] === '-') i++;
                while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++;
                // 检查范围符号 ..
                if (i < len && command[i] === '.' && i + 1 < len && command[i + 1] === '.') {
                    i += 2; // 跳过 ..
                    // 读取范围上限
                    if (i < len && (command[i] === '+' || command[i] === '-')) i++;
                    while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++;
                }
                tokens.push({ token: command.slice(start, i), type: 'Number', start, end: i });
                continue;
            }

            // 单独的 . 开头的范围  ..10
            if (command[i] === '.' && i + 1 < len && command[i + 1] === '.') {
                i += 2;
                if (i < len && (command[i] === '+' || command[i] === '-')) i++;
                while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++;
                tokens.push({ token: command.slice(start, i), type: 'Range', start, end: i });
                continue;
            }

            // ! 叹号（用于 score matches 的取反）
            if (command[i] === '!') {
                i++;
                tokens.push({ token: command.slice(start, i), type: 'Not', start, end: i });
                continue;
            }

            // @ 开头的选择器
            if (command[i] === '@') {
                i++;
                // 选择器类型 a/e/p/r/s
                while (i < len && command[i] !== ' ' && command[i] !== '[' && command[i] !== '\t') i++;
                // 选择器参数 [...]
                if (i < len && command[i] === '[') {
                    let bracketDepth = 1;
                    i++;
                    while (i < len && bracketDepth > 0) {
                        if (command[i] === '[') bracketDepth++;
                        else if (command[i] === ']') bracketDepth--;
                        i++;
                    }
                }
                tokens.push({ token: command.slice(start, i), type: 'Selector', start, end: i });
                continue;
            }

            // { 开头的 JSON NBT
            if (command[i] === '{') {
                let depth = 1;
                i++;
                while (i < len && depth > 0) {
                    if (command[i] === '{') depth++;
                    else if (command[i] === '}') depth--;
                    else if (command[i] === '"' || command[i] === "'") {
                        const q = command[i];
                        i++;
                        while (i < len && command[i] !== q) {
                            if (command[i] === '\\') i++;
                            i++;
                        }
                    }
                    i++;
                }
                tokens.push({ token: command.slice(start, i), type: 'NBT', start, end: i });
                continue;
            }

            // = < > 比较运算符 (score 比较用)
            if (command[i] === '=' || command[i] === '<' || command[i] === '>') {
                // 处理 <= >= 
                if (i + 1 < len && command[i + 1] === '=') {
                    i += 2;
                } else {
                    i++;
                }
                tokens.push({ token: command.slice(start, i), type: 'Operator', start, end: i });
                continue;
            }

            // 普通单词 (标识符、命令名、方块ID等)
            while (i < len && command[i] !== ' ' && command[i] !== '\t' &&
                   command[i] !== '"' && command[i] !== "'" && command[i] !== '{' &&
                   command[i] !== '[' && command[i] !== '!' && command[i] !== '=' &&
                   command[i] !== '<' && command[i] !== '>') {
                i++;
            }

            if (i > start) {
                const token = command.slice(start, i);
                // 判断 token 类型
                let type = 'Word';
                if (/^-?\d+$/.test(token)) type = 'Int';
                else if (/^-?\d+\.\d+$/.test(token)) type = 'Float';
                tokens.push({ token, type, start, end: i });
            } else {
                // 未知字符，跳过
                i++;
            }
        }

        return tokens;
    }

    // ============================================================
    //  选择器解析器 - 简化版，只提取选择器字符串用于拼接
    // ============================================================

    /**
     * 从 token 列表中读取一个完整的选择器
     * 返回 [选择器字符串, 新的index]
     */
    function readSelector(tokens, index) {
        if (index >= tokens.length) {
            throw new CompileError('期望选择器，但到达命令末尾');
        }
        const t = tokens[index];
        if (t.type === 'Selector') {
            return [t.token, index + 1];
        }
        // 也可能是玩家名
        if (t.type === 'Word' || t.type === 'String') {
            return [t.token, index + 1];
        }
        throw new CompileError(`期望选择器，但得到: ${t.token}`, t.start);
    }

    /**
     * 从 token 列表中读取一个坐标（3个分量）
     * 返回 [坐标字符串, 新的index]
     */
    function readPosition(tokens, index) {
        if (index + 2 >= tokens.length) {
            throw new CompileError('期望3个坐标分量，但命令长度不足');
        }
        const coords = [];
        for (let i = 0; i < 3; i++) {
            const t = tokens[index + i];
            if (t.type !== 'Coordinate' && t.type !== 'Number' && t.type !== 'Int' && t.type !== 'Float') {
                // 允许纯数字和 ~^ 开头的坐标
                if (!/^[~^]?[-+]?\d*\.?\d*$/.test(t.token)) {
                    throw new CompileError(`期望坐标分量，但得到: ${t.token}`, t.start);
                }
            }
            coords.push(t.token);
        }
        return [coords.join(' '), index + 3];
    }

    /**
     * 从 token 列表中读取一个旋转（2个分量）
     * 返回 [旋转字符串, 新的index]
     */
    function readRotation(tokens, index) {
        if (index + 1 >= tokens.length) {
            throw new CompileError('期望2个旋转分量，但命令长度不足');
        }
        const rots = [];
        for (let i = 0; i < 2; i++) {
            const t = tokens[index + i];
            rots.push(t.token);
        }
        return [rots.join(' '), index + 2];
    }

    // ============================================================
    //  旧版 execute 编译器 (1.19 之前)
    //  格式: execute <选择器> <坐标> [detect <坐标> <方块> <数据值>] <子命令>
    // ============================================================

    /**
     * 判断坐标是否为 ~ ~ ~ 的等效值（相对偏移为0）
     */
    function isZeroOffset(pos) {
        return /^~0?(\.0+)? ~0?(\.0+)? ~0?(\.0+)?$/.test(pos) || /^~~~$/.test(pos.replace(/\s/g, ''));
    }

    function compileOldExecute(tokens, startIndex) {
        let index = startIndex;
        const subcommandParts = []; // 存储新版子命令片段

        while (index < tokens.length) {
            // 读取选择器
            let selector;
            [selector, index] = readSelector(tokens, index);

            // 读取坐标
            let pos;
            [pos, index] = readPosition(tokens, index);

            // 生成子命令：as + at @s，坐标非零时才加 positioned
            let part = `as ${selector} at @s`;
            if (!isZeroOffset(pos)) {
                part += ` positioned ${pos}`;
            }
            subcommandParts.push(part);

            // 检查下一个 token
            if (index >= tokens.length) break;

            if (tokens[index].token.toLowerCase() === 'detect') {
                index++; // 跳过 detect

                // 读取检测坐标
                let detectPos;
                [detectPos, index] = readPosition(tokens, index);

                // 读取方块ID
                if (index >= tokens.length) throw new CompileError('detect 后缺少方块ID');
                const blockId = tokens[index].token;
                index++;

                // 读取数据值
                let dataValue = '-1';
                if (index < tokens.length) {
                    const nextToken = tokens[index];
                    if (nextToken.type === 'Int' || nextToken.type === 'Number' ||
                        (nextToken.type === 'Word' && /^-?\d+$/.test(nextToken.token))) {
                        dataValue = nextToken.token;
                        index++;
                    }
                }

                // 构建 if block 条件
                let ifBlock;
                if (dataValue === '-1' || dataValue === '*') {
                    ifBlock = `if block ${detectPos} ${blockId}`;
                } else {
                    ifBlock = `if block ${detectPos} ${blockId} ${dataValue}`;
                }
                // 将 detect 条件附加到最后一个子命令
                subcommandParts[subcommandParts.length - 1] += ` ${ifBlock}`;

                // 检查后面是否继续嵌套 execute
                if (index >= tokens.length) break;
                if (tokens[index].token.toLowerCase() === 'execute') {
                    index++; // 跳过嵌套的 execute
                    continue;
                }
                // 否则后面就是要执行的子命令
                break;
            } else if (tokens[index].token.toLowerCase() === 'execute') {
                index++; // 跳过嵌套的 execute
                continue;
            } else {
                // 后面就是要执行的子命令
                break;
            }
        }

        // 剩余的 token 就是要执行的子命令
        const remainingCommand = tokens.slice(index).map(t => t.token).join(' ');

        // 拼装结果
        let result = 'execute';
        for (const part of subcommandParts) {
            result += ` ${part}`;
        }
        result += ` run ${remainingCommand}`;

        return result;
    }

    // ============================================================
    //  新版 execute 编译器 (1.19.50+)
    //  格式: execute <子命令...> run <命令>
    //  此版本不需要转换，直接原样输出（但需要处理嵌套旧版 execute）
    // ============================================================

    /**
     * 判断 token 流是否为新版 execute 语法
     * 新版以 execute 开头，第二个 token 是子命令关键字 (as/at/in/if/unless/align/anchored/facing/positioned/rotated/run)
     */
    const NEW_SUBCOMMANDS = new Set(['as', 'at', 'in', 'if', 'unless', 'align', 'anchored', 'facing', 'positioned', 'rotated', 'run']);

    function isNewExecuteSyntax(tokens) {
        if (tokens.length < 2) return false;
        if (tokens[0].token.toLowerCase() !== 'execute') return false;
        return NEW_SUBCOMMANDS.has(tokens[1].token.toLowerCase());
    }

    /**
     * 判断 token 流是否为旧版 execute 语法
     * 旧版: execute <选择器> <坐标> ...
     */
    function isOldExecuteSyntax(tokens) {
        if (tokens.length < 2) return false;
        if (tokens[0].token.toLowerCase() !== 'execute') return false;
        const second = tokens[1];
        // 旧版第二个 token 是选择器 (@...) 或玩家名
        return second.type === 'Selector' ||
               (second.type === 'Word' && !NEW_SUBCOMMANDS.has(second.token.toLowerCase()));
    }

    // ============================================================
    //  主转换逻辑 - 递归处理嵌套 execute
    // ============================================================

    /**
     * 处理单行命令，递归转换嵌套的旧版 execute
     */
    function processCommand(command) {
        command = command.replace(/\s{2,}/g, ' ').trim();
        if (!command) throw new CompileError('命令为空');

        // 检查是否是 execute 开头
        if (!/^execute\b/i.test(command)) return command;

        const tokens = tokenize(command);

        if (isOldExecuteSyntax(tokens)) {
            // 旧版语法 - 需要转换
            const result = compileOldExecute(tokens, 1);
            // 清理 positioned ~ ~ ~（无意义的定位）
            return cleanResult(result);
        }

        if (isNewExecuteSyntax(tokens)) {
            // 新版语法 - 检查是否有嵌套的旧版 execute 在 run 后面
            return processNewExecute(tokens);
        }

        // 无法判断，尝试旧版
        try {
            const result = compileOldExecute(tokens, 1);
            return cleanResult(result);
        } catch (e) {
            throw new CompileError(`无法识别的execute语法: ${command}`);
        }
    }

    /**
     * 处理新版 execute，递归检查 run 后面是否有旧版嵌套
     * 关键：当新版 execute 的 run 后面跟旧版 execute 时，需要合并子命令链
     * 例如: execute as @s run execute @e ~~~ say hi
     *   -> execute as @s as @e at @s run say hi
     */
    function processNewExecute(tokens) {
        const subcommandList = [];
        let i = 0;

        // 跳过开头的 execute
        if (i < tokens.length && tokens[i].token.toLowerCase() === 'execute') {
            i++;
        }

        while (i < tokens.length) {
            const token = tokens[i];

            if (token.token.toLowerCase() === 'run') {
                if (i + 1 < tokens.length && tokens[i + 1].token.toLowerCase() === 'execute') {
                    const remainingTokens = tokens.slice(i + 1);
                    if (isOldExecuteSyntax(remainingTokens)) {
                        // 旧版嵌套在新版 run 后 - 转换并合并子命令
                        const convertedSub = compileOldExecute(remainingTokens, 1);
                        const subTokens = tokenize(convertedSub);
                        if (subTokens.length > 0 && subTokens[0].token.toLowerCase() === 'execute') {
                            // 跳过转换结果开头的 execute，收集所有子命令
                            for (let j = 1; j < subTokens.length; j++) {
                                subcommandList.push(subTokens[j].token);
                            }
                        }
                        i = tokens.length;
                        continue;
                    } else {
                        // 新版嵌套新版 - 递归处理并合并
                        const innerResult = processNewExecute(remainingTokens);
                        const innerTokens = tokenize(innerResult);
                        if (innerTokens.length > 0 && innerTokens[0].token.toLowerCase() === 'execute') {
                            for (let k = 1; k < innerTokens.length; k++) {
                                subcommandList.push(innerTokens[k].token);
                            }
                        } else {
                            subcommandList.push('run');
                            subcommandList.push(innerResult);
                        }
                        i = tokens.length;
                        continue;
                    }
                } else {
                    // run 后面不是 execute，正常结束
                    i++;
                    const remainingCommand = tokens.slice(i).map(t => t.token).join(' ');
                    subcommandList.push('run');
                    subcommandList.push(remainingCommand);
                    i = tokens.length;
                    continue;
                }
            }

            // 普通子命令 token，直接收集
            subcommandList.push(token.token);
            i++;
        }

        return cleanResult('execute ' + subcommandList.join(' '));
    }

    /**
     * 清理转换结果
     */
    function cleanResult(result) {
        return result
            // 去掉 positioned ~~~ 和 positioned ~ ~ ~
            .replace(/\bpositioned ~~~\b/g, '')
            .replace(/\bpositioned ~ ~ ~\b/g, '')
            // 去掉 positioned ~0 ~0 ~0 等等效写法
            .replace(/\bpositioned ~0(?:\.0+)? ~0(?:\.0+)? ~0(?:\.0+)?\b/g, '')
            // 清理多余空格
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    // ============================================================
    //  批量处理多行输入
    // ============================================================

    function convertExecuteCommand(input) {
        try {
            if (!input.trim()) {
                throw new CompileError('输入为空');
            }

            // 按行处理，支持多条命令
            const lines = input.split('\n');
            const results = [];
            const errors = [];

            for (let lineNum = 0; lineNum < lines.length; lineNum++) {
                const line = lines[lineNum].trim();
                if (!line) {
                    results.push('');
                    continue;
                }

                try {
                    // 去掉开头的 /
                    let cmd = line.replace(/^\//, '').replace(/\s{2,}/g, ' ').trim();
                    if (!/^execute\b/i.test(cmd)) {
                        // 不是 execute 命令，原样保留
                        results.push(line.startsWith('/') ? line : line);
                        continue;
                    }
                    const converted = processCommand(cmd);
                    // 如果原始有 / 则保留
                    results.push((line.startsWith('/') ? '/' : '') + converted);
                } catch (e) {
                    errors.push(`第${lineNum + 1}行: ${e.message}`);
                    results.push(line); // 出错时保留原文
                }
            }

            if (errors.length > 0) {
                return { result: results.join('\n'), errors };
            }
            return { result: results.join('\n'), errors: [] };

        } catch (err) {
            return { result: '', errors: [err.message] };
        }
    }

    // ============================================================
    //  UI 逻辑
    // ============================================================

    function performConversion() {
        const inputText = getInputText();
        if (!inputText.trim()) {
            showStatus('请输入需要转换的文本', 'warning');
            return;
        }

        try {
            const { result, errors } = convertExecuteCommand(inputText);

            if (errors.length > 0) {
                setOutputText(result);
                showStatus(`转换完成，但有 ${errors.length} 个错误: ${errors[0]}`, 'error');
            } else {
                setOutputText(result);
                showStatus('转换成功！', 'success');
            }
        } catch (error) {
            console.error('未处理的异常:', error);
            setOutputText('');
            showStatus(`转换失败: ${error.message}`, 'error');
        }
    }

    function init() {
        convertBtn.addEventListener('click', performConversion);
        copyBtn.addEventListener('click', copyToClipboard);
        clearBtn.addEventListener('click', handleClearClick);

        backButton.addEventListener('click', () => {
            if (history.length > 1) {
                const fallbackTimer = setTimeout(() => {
                    location.href = "/";
                }, 300);
                window.history.back();
                window.addEventListener('popstate', function handlePop() {
                    clearTimeout(fallbackTimer);
                    window.removeEventListener('popstate', handlePop);
                }, { once: true });
            } else {
                location.href = "/";
            }
        });

        showStatus('--');
        inputElement.focus();
    }

    return {
        init: init
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    TextConverterApp.init();
});
