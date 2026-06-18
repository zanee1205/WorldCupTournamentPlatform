import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({model: 'gemini-2.5-flash'});

router.post('/ask', async (req, res) => {
    try {
        const { question, matchTitle, stageLabel } = req.body;

        if (!question) {
            res.status(400).json({ message: 'Thiếu câu hỏi.' });
            return;
        }

        const prompt = `
            Bạn là một chuyên gia phân tích bóng đá nhiều năm kinh nghiệm, và bạn 
            sẽ phân tích các trận đấu của World Cup 2026, giải bóng đá lớn nhất hành tinh.
            Trận đấu: ${matchTitle ?? 'Không rõ'} (${stageLabel ?? 'Không rõ'})
            Câu hỏi: ${question}
            Trả lời bằng tiếng việt, ngắn gọn, xúc tích và chuyên nghiệp.
        `;

        const result = await model.generateContent(prompt);
        res.json({answer: result.response.text()});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi khi gọi API, kiểm tra lại.' });
    }
});

export default router;