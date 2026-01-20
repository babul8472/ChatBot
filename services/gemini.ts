
import { GoogleGenAI } from "@google/genai";
import { GroundingChunk } from "../types";

// Always initialize GoogleGenAI with the process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface StreamResult {
  text: string;
  imageUrl?: string;
  groundingLinks?: GroundingChunk[];
  isDone: boolean;
}

export class ChatService {
  async *sendMessageStream(message: string, fileBase64?: string, mimeType?: string): AsyncGenerator<StreamResult> {
    const isMapQuery = /map|near me|restaurant|directions/i.test(message);
    const isGenerationQuery = /generate|create|draw|make (an )?image|painting/i.test(message);
    const isImage = mimeType?.startsWith('image/');
    
    // Model Selection
    let modelName = 'gemini-3-flash-preview'; 
    if (isImage || isGenerationQuery) {
      modelName = 'gemini-2.5-flash-image';
    } else if (isMapQuery) {
      modelName = 'gemini-2.5-flash';
    }

    const config: any = {};
    const contents: any = { parts: [] };

    if (fileBase64) {
      // Attachment Case (Analyze existing image or file)
      contents.parts.push({ inlineData: { data: fileBase64, mimeType: mimeType || 'application/octet-stream' } });
      contents.parts.push({ text: message || "Analyze this file." });
    } else {
      // Prompt Case (Text only)
      contents.parts.push({ text: message });
    }

    // Tool Assignment - CRITICAL: Do not add tools to the image model!
    if (modelName !== 'gemini-2.5-flash-image') {
      config.thinkingConfig = { thinkingBudget: 0 }; // Optimize for speed on text models

      if (isMapQuery) {
        config.tools = [{ googleMaps: {} }];
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 })
          );
          config.toolConfig = {
            retrievalConfig: {
              latLng: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
            }
          };
        } catch (e) {
          console.warn("Location skipped for speed");
        }
      } else {
        config.tools = [{ googleSearch: {} }];
      }
    } else {
      // Specific config for Image Generation
      config.imageConfig = {
        aspectRatio: "1:1"
      };
    }

    try {
      // Routing based on streaming capability
      if (modelName !== 'gemini-2.5-flash-image') {
        const result = await ai.models.generateContentStream({
          model: modelName,
          contents: [contents],
          config
        });

        let fullText = "";
        let groundingLinks: GroundingChunk[] = [];

        for await (const chunk of result) {
          const text = chunk.text || "";
          fullText += text;
          
          if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
             groundingLinks = chunk.candidates[0].groundingMetadata.groundingChunks as unknown as GroundingChunk[];
          }

          yield {
            text: fullText,
            groundingLinks,
            isDone: false
          };
        }
        
        yield { text: fullText, groundingLinks, isDone: true };
      } else {
        // Nano banana (image) models do not support streaming, use standard call
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [contents],
          config
        });

        const candidate = response.candidates?.[0];
        let responseText = "";
        let responseImageUrl = "";

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              responseText += part.text;
            } else if (part.inlineData) {
              responseImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          }
        }

        yield {
          text: responseText || (responseImageUrl ? "Here's what I created for you:" : ""),
          imageUrl: responseImageUrl,
          isDone: true
        };
      }
    } catch (error) {
      console.error("Gemini Error:", error);
      yield { text: "I'm sorry, I couldn't complete that request. Please try a different prompt or check your connection.", isDone: true };
    }
  }

  reset() {}
}

export const chatService = new ChatService();
