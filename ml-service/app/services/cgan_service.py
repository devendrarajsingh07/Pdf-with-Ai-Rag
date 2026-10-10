"""Inference adapter for the official CycleGAN/pix2pix generator, not a trainer.

Only administrator-provided, document-trained state_dict checkpoints are supported.
The PDF and full-resolution raster remain unmodified on disk.
"""
import hashlib
import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image
from app.core.config import settings


UPSTREAM_REVISION = '2a7afba2895d52556dd5dfe07e8555ef657ced6f'


def tile_starts(length: int, size: int, overlap: int) -> list[int]:
    if overlap < 0 or overlap >= size:
        raise ValueError('Invalid tile overlap')
    return list(range(0, max(1, length - size + 1), size - overlap)) + (
        [length - size] if length > size and (length - size) % (size - overlap) else [])


class CGANService:
    def __init__(self):
        self._generator = None
        self.checkpoint_digest = None

    def _load(self):
        import torch
        if not settings.cgan_checkpoint:
            raise RuntimeError('A document-trained CGAN_CHECKPOINT is required')
        checkpoint = Path(settings.cgan_checkpoint).expanduser().resolve(strict=True)
        if checkpoint.stat().st_size > 1_000_000_000:
            raise ValueError('Checkpoint exceeds the 1 GB limit')
        with checkpoint.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if settings.cgan_checkpoint_sha256 and digest != settings.cgan_checkpoint_sha256.lower():
            raise ValueError('Checkpoint digest mismatch')
        # Load upstream as an isolated module: never put its generic "models" on sys.path.
        source = Path(settings.cgan_repo_dir).resolve(strict=True) / 'models' / 'networks.py'
        spec = importlib.util.spec_from_file_location('documind_cgan_networks', source)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        generator = module.define_G(settings.cgan_channels, settings.cgan_channels,
            settings.cgan_ngf, settings.cgan_net_g, norm=settings.cgan_norm,
            use_dropout=settings.cgan_use_dropout)
        state = torch.load(checkpoint, map_location='cpu', weights_only=True)
        generator.load_state_dict(state, strict=True)
        generator.to(settings.ocr_device).eval()
        self.checkpoint_digest = digest
        self._generator = generator

    def enhance(self, image: Image.Image) -> Image.Image:
        import torch
        size, overlap = settings.cgan_tile_size, settings.cgan_tile_overlap
        width, height = image.size
        xs, ys = tile_starts(width, size, overlap), tile_starts(height, size, overlap)
        if len(xs) * len(ys) > settings.cgan_max_tiles:
            raise ValueError('Page exceeds the GAN tile budget')
        if self._generator is None:
            self._load()
        channels = settings.cgan_channels
        source = np.asarray(image.convert('RGB' if channels == 3 else 'L'), dtype=np.float32)
        if channels == 1:
            source = source[..., None]
        output = np.zeros_like(source)
        weights = np.zeros((height, width, 1), dtype=np.float32)
        # Feather overlaps; strictly positive weights also cover all outer edges.
        ramp = np.minimum(np.arange(size) + 1, np.arange(size, 0, -1))
        blend = np.minimum(1.0, ramp / max(1, overlap)).astype(np.float32)
        blend = (blend[:, None] * blend[None, :])[..., None]
        with torch.inference_mode():
            for y in ys:
                for x in xs:
                    tile = source[y:y + size, x:x + size]
                    h, w = tile.shape[:2]
                    tile = np.pad(tile, ((0, size - h), (0, size - w), (0, 0)), mode='edge')
                    tensor = torch.from_numpy(tile.transpose(2, 0, 1).copy()).unsqueeze(0)
                    tensor = (tensor.to(settings.ocr_device) / 127.5) - 1
                    prediction = self._generator(tensor)
                    if prediction.shape != tensor.shape or not torch.isfinite(prediction).all():
                        raise ValueError('Invalid generator output')
                    cleaned = ((prediction[0].cpu().numpy().transpose(1, 2, 0) + 1) * 127.5)
                    output[y:y + h, x:x + w] += cleaned[:h, :w] * blend[:h, :w]
                    weights[y:y + h, x:x + w] += blend[:h, :w]
        output = np.clip(output / weights, 0, 255).round().astype(np.uint8)
        return Image.fromarray(output if channels == 3 else output[..., 0]).convert('RGB')
