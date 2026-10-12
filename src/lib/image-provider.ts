export type ImageInput = {
  prompt: string;
  image_input: string[];
  aspect_ratio: string;
  resolution: string;
  output_format: string;
};

export type ImageResult =
  | { status: "pending" }
  | { status: "success"; urls: string[] }
  | { status: "failed"; error: string };

export interface ImageProvider {
  uploadFile(assetId: string): Promise<string>;
  submit(model: string, input: ImageInput): Promise<string>;
  getResult(taskId: string): Promise<ImageResult>;
}
