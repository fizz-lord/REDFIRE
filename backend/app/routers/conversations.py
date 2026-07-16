from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Conversation, ConversationTurn, Target
from app.schemas import ConversationCreate, ConversationOut, ConversationMessage, ConversationTurnOut
from app.providers import call_provider, build_messages
from app.scoring import score_response

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).options(selectinload(Conversation.turns)).order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(data: ConversationCreate, db: AsyncSession = Depends(get_db)):
    target = await db.execute(select(Target).where(Target.id == data.target_id))
    if not target.scalar_one_or_none():
        raise HTTPException(404, "Target not found")
    conv = Conversation(target_id=data.target_id, name=data.name or f"Conversation")
    db.add(conv)
    await db.commit()
    await db.refresh(conv, ["turns"])
    return conv


@router.get("/{conv_id}", response_model=ConversationOut)
async def get_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).options(selectinload(Conversation.turns)).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


@router.delete("/{conv_id}", status_code=204)
async def delete_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    await db.delete(conv)
    await db.commit()


@router.post("/{conv_id}/message", response_model=ConversationOut)
async def send_message(conv_id: int, data: ConversationMessage, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).options(selectinload(Conversation.turns)).where(Conversation.id == conv_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    target = await db.execute(select(Target).where(Target.id == conv.target_id))
    target = target.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Target not found")

    # Build message history from previous turns + new message
    messages = [{"role": "system", "content": "You are a helpful assistant."}]
    for turn in conv.turns:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": data.content})

    response = await call_provider(
        target.provider, None, target.api_key or "", target.model, target.endpoint or "",
        messages=messages,
    )

    response_text = response if response else "[Error: No response]"
    sd = score_response(data.content, response_text, "high")

    # Save user message
    turn_user = ConversationTurn(
        conversation_id=conv.id,
        order=len(conv.turns),
        role="user",
        content=data.content,
    )
    db.add(turn_user)

    # Save assistant response
    turn_asst = ConversationTurn(
        conversation_id=conv.id,
        order=len(conv.turns) + 1,
        role="assistant",
        content=response_text,
        score=sd["score"],
        label=sd["label"],
        refusal_signals=sd["refusal_signals"],
        compliance_signals=sd["compliance_signals"],
        details=sd["detail"],
    )
    db.add(turn_asst)
    await db.commit()

    # Return full conversation so frontend gets both turns
    result = await db.execute(
        select(Conversation).options(selectinload(Conversation.turns)).where(Conversation.id == conv.id)
    )
    return result.scalar_one()
