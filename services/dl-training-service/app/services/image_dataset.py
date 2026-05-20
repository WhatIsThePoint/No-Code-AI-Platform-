"""Image-dataset loading utilities.

The on-disk layout matches `torchvision.datasets.ImageFolder` so we get
class discovery for free:

    IMAGE_DATASET_ROOT/<dataset_id>/<class_name>/<file>.{jpg,png,...}

Two transform pipelines, both ending with ImageNet normalization so the
pretrained MobileNet path doesn't suffer a distribution shift the moment a
fresh dataset gets pointed at it. The "train" pipeline can opt into light
augmentation (random horizontal flip + small colour jitter); "eval" is
deterministic — needed for stable validation metrics across epochs.
"""

from __future__ import annotations

import os
from typing import Tuple

# ImageNet RGB statistics — applied unconditionally because (a) MobileNet
# pretrained weights expect them, and (b) using the same normalisation for
# the from-scratch archs makes pretrained vs. from-scratch experiments
# comparable without a flag.
_IMAGENET_MEAN = (0.485, 0.456, 0.406)
_IMAGENET_STD = (0.229, 0.224, 0.225)


def build_transforms(input_size: int, augment: bool):
    """Returns (train_transform, eval_transform).

    Imported lazily so test environments without torchvision still load
    `app.services.image_dataset`.
    """
    from torchvision import transforms

    eval_tx = transforms.Compose(
        [
            # `Resize(int)` keeps aspect ratio, then CenterCrop produces a
            # square — preserves more information than `Resize((s, s))` on
            # rectangular natural images.
            transforms.Resize(int(input_size * 1.15)),
            transforms.CenterCrop(input_size),
            transforms.ToTensor(),
            transforms.Normalize(_IMAGENET_MEAN, _IMAGENET_STD),
        ]
    )

    if not augment:
        return eval_tx, eval_tx

    train_tx = transforms.Compose(
        [
            transforms.Resize(int(input_size * 1.15)),
            transforms.RandomCrop(input_size, padding=4, padding_mode="reflect"),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
            transforms.ToTensor(),
            transforms.Normalize(_IMAGENET_MEAN, _IMAGENET_STD),
        ]
    )
    return train_tx, eval_tx


def load_split(
    dataset_root: str,
    dataset_id: str,
    input_size: int,
    augment: bool,
    val_fraction: float = 0.2,
    seed: int = 1234,
) -> Tuple[object, object, dict[int, str]]:
    """Returns (train_subset, val_subset, idx_to_class).

    The two subsets share the underlying ImageFolder but apply different
    transforms via a small wrapper — this avoids reading every file twice
    (once per pipeline) which would double-blow the disk cache on small
    datasets.
    """
    import torch
    from torch.utils.data import Subset, random_split
    from torchvision.datasets import ImageFolder

    train_tx, eval_tx = build_transforms(input_size, augment)

    folder = os.path.join(dataset_root, dataset_id)
    if not os.path.isdir(folder):
        raise FileNotFoundError(
            f"Image dataset folder not found: {folder}. Did the extract task finish?"
        )

    # Two ImageFolder instances bound to the same files but different
    # transforms. random_split returns Subsets backed by index lists; we
    # pair the train indices with the train-transform dataset and the val
    # indices with the eval-transform dataset to keep their pipelines
    # independent without re-reading the directory tree.
    base_train = ImageFolder(root=folder, transform=train_tx)
    base_eval = ImageFolder(root=folder, transform=eval_tx)

    if not base_train.samples:
        raise ValueError(
            f"Image dataset {dataset_id} is empty — no files matched ImageFolder's "
            f"<class>/<file> layout."
        )

    n = len(base_train)
    n_val = max(1, int(round(n * val_fraction)))
    n_train = n - n_val
    if n_train < 1:
        raise ValueError(
            f"Dataset has only {n} images; cannot split off a validation fold."
        )

    g = torch.Generator().manual_seed(seed)
    train_indices_set, val_indices_set = random_split(range(n), [n_train, n_val], generator=g)

    train_subset = Subset(base_train, list(train_indices_set))
    val_subset = Subset(base_eval, list(val_indices_set))

    # ImageFolder.class_to_idx is name->int; we want int->name for the
    # class_index.json sidecar that the predict path reads back.
    idx_to_class = {idx: name for name, idx in base_train.class_to_idx.items()}
    return train_subset, val_subset, idx_to_class
