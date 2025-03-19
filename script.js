document.addEventListener('DOMContentLoaded', () => {
    const englishNameInput = document.getElementById('englishName');
    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.querySelector('.loading');
    const resultsDiv = document.querySelector('.results');
    const errorDiv = document.querySelector('.error');
    const nameCards = document.querySelectorAll('.name-card');

    generateBtn.addEventListener('click', async () => {
        const englishName = englishNameInput.value.trim();
        if (!englishName) {
            errorDiv.textContent = '请输入英文名';
            errorDiv.style.display = 'block';
            return;
        }

        // 重置显示状态
        errorDiv.style.display = 'none';
        resultsDiv.style.display = 'none';
        loadingDiv.style.display = 'block';
        generateBtn.disabled = true;

        try {
            const response = await fetch('http://localhost:3000/generate-names', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ englishName })
            });

            if (!response.ok) {
                throw new Error('网络请求失败');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            const content = data.choices[0].message.content;
            let namesData;
            try {
                // 去除可能存在的Markdown代码块标记
                const cleanContent = content.replace(/^\s*```json\s*|\s*```\s*$/g, '');
                namesData = JSON.parse(cleanContent);
                if (!namesData.names || !Array.isArray(namesData.names)) {
                    throw new Error('返回数据格式不正确');
                }
            } catch (error) {
                throw new Error('解析名字数据失败：' + error.message);
            }

            const nameCards = document.querySelectorAll('.name-card');
            
            // 显示结果
            namesData.names.forEach((name, index) => {
                if (index >= nameCards.length) return;
                const card = nameCards[index];
                if (!name.chinese || !name.explanation || !name.explanation.chinese || !name.explanation.english) {
                    card.querySelector('.chinese-name').textContent = '数据格式错误';
                    card.querySelector('.meaning').innerHTML = '<p>无法显示此名字的解释</p>';
                    return;
                }
                card.querySelector('.chinese-name').textContent = name.chinese;
                card.querySelector('.meaning').innerHTML = 
                    `<p>${name.explanation.chinese}</p><p>${name.explanation.english}</p>`;
            });

            resultsDiv.style.display = 'block';
        } catch (error) {
            errorDiv.textContent = error.message || '生成名字时出错，请稍后重试';
            errorDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
            generateBtn.disabled = false;
        }
    });
});