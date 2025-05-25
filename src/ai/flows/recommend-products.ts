// src/ai/flows/recommend-products.ts
'use server';
/**
 * @fileOverview AI-powered product recommendation flow.
 *
 * - recommendProducts - A function that recommends products based on a search query.
 * - RecommendProductsInput - The input type for the recommendProducts function.
 * - RecommendProductsOutput - The return type for the recommendProducts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendProductsInputSchema = z.object({
  searchQuery: z.string().describe('The user search query.'),
  productCategories: z.array(z.string()).optional().describe('List of available product categories.'),
  products: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      price: z.number(),
      category: z.string(),
    })
  ).describe('List of available products to recommend from')
});
export type RecommendProductsInput = z.infer<typeof RecommendProductsInputSchema>;

const RecommendProductsOutputSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    price: z.number(),
    category: z.string(),
  })
).describe('Recommended products based on the search query.');
export type RecommendProductsOutput = z.infer<typeof RecommendProductsOutputSchema>;

export async function recommendProducts(input: RecommendProductsInput): Promise<RecommendProductsOutput> {
  return recommendProductsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendProductsPrompt',
  input: {schema: RecommendProductsInputSchema},
  output: {schema: RecommendProductsOutputSchema},
  prompt: `You are a product recommendation expert. Given a user's search query and a list of available products, you will recommend products that are relevant to the search query.

Search Query: {{{searchQuery}}}

Available Products:
{{#each products}}
- Name: {{this.name}}, Description: {{this.description}}, Price: {{this.price}}, Category: {{this.category}}
{{/each}}

Product Categories: {{productCategories}}

Based on the search query, recommend products from the list of available products. Only return products that are thematically related to the search query. Do not recommend products that are not related to the search query. Consider product categories to help narrow down the recommendations.

Return the recommended products in JSON format.
`,
});

const recommendProductsFlow = ai.defineFlow(
  {
    name: 'recommendProductsFlow',
    inputSchema: RecommendProductsInputSchema,
    outputSchema: RecommendProductsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
