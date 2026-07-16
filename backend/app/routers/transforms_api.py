from fastapi import APIRouter, HTTPException

from app.transforms import TRANSFORMS, TRANSFORM_CATEGORIES, apply_chain, recommend_transforms
from app.schemas import TransformInfo, TransformChainRequest, TransformChainResult

router = APIRouter(prefix="/api/transforms", tags=["transforms"])


@router.get("", response_model=list[TransformInfo])
async def list_transforms():
    result = []
    for name in TRANSFORMS:
        cats = [cat for cat, names in TRANSFORM_CATEGORIES.items() if name in names]
        result.append(TransformInfo(name=name, categories=cats or ["uncategorized"]))
    return result


@router.get("/categories", response_model=dict[str, list[str]])
async def list_categories():
    return TRANSFORM_CATEGORIES


@router.post("/apply", response_model=TransformChainResult)
async def apply_transforms(data: TransformChainRequest):
    if not data.transforms:
        return TransformChainResult(original=data.prompt, transformed=data.prompt, chain=[])
    invalid = [t for t in data.transforms if t not in TRANSFORMS]
    if invalid:
        raise HTTPException(400, f"Unknown transforms: {invalid}")
    transformed = apply_chain(data.prompt, data.transforms)
    return TransformChainResult(original=data.prompt, transformed=transformed, chain=data.transforms)


@router.get("/recommend")
async def recommend(target_model: str = ""):
    chain = recommend_transforms("", target_model)
    return {"transforms": chain, "target_model": target_model}
