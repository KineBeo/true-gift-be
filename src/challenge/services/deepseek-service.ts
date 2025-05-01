import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly apiUrl: string;
  
  constructor(private configService: ConfigService) {
    // In a real app, this would come from env variables
    this.apiUrl = this.configService.get<string>('DEEPSEEK_API_URL') || 'http://192.168.1.208:1234';
  }

  /**
   * Generate a challenge description for a given class using Deepseek LLM
   */
  async generateChallengeDescription(className: string): Promise<string> {
    try {
      const prompt = this.buildChallengePrompt(className);
      this.logger.log(`Generating challenge description for class: ${className}`);

      const response = await axios.post(
        `${this.apiUrl}/v1/chat/completions`,
        {
          model: 'deepseek-r1',
          messages: [
            {
              role: 'system',
              content: 'You are a creative assistant that creates engaging photo challenges.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content.trim();
      }

      return this.getFallbackDescription(className);
    } catch (error) {
      this.logger.error(`Error generating challenge description: ${error.message}`);
      // Return a fallback description if the API call fails
      return this.getFallbackDescription(className);
    }
  }

  /**
   * Build a prompt for the Deepseek model
   */
  private buildChallengePrompt(className: string): string {
    return `Create a concise, engaging photo challenge description for taking a picture of "${className}".
    The description should:
    - Be in Vietnamese
    - Be brief (maximum 15 words)
    - Be creative and fun
    - Start with "Chụp ảnh"
    - Focus specifically on ${className}
    
    Just return the challenge text with no additional comments or explanations.`;
  }

  /**
   * Get a fallback description if the API call fails
   */
  private getFallbackDescription(className: string): string {
    return `Chụp ảnh ${className} đẹp nhất của bạn`;
  }
} 