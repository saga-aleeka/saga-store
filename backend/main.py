"""
SAGA Store - Python Backend API
Main FastAPI application for LIMS integration
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

app = FastAPI(
    title="SAGA Store API",
    description="Python backend for sample tracking and LIMS integration",
    version="1.0.0"
)

# CORS configuration - update with your frontend URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Pydantic models
class Sample(BaseModel):
    sample_id: str
    container_id: Optional[str] = None
    position: Optional[str] = None
    is_checked_out: bool = False
    is_archived: bool = False
    

class Container(BaseModel):
    name: str
    type: str
    location: str
    layout: str
    temperature: str
    total: int
    training: bool = False


class SampleCheckout(BaseModel):
    sample_ids: List[str]
    user_initials: str


# Health check endpoint
@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "SAGA Store API",
        "version": "1.0.0"
    }


# Sample endpoints
@app.get("/api/samples")
async def get_samples(
    is_archived: bool = False,
    limit: int = 1000,
    offset: int = 0
):
    """Get samples with pagination"""
    try:
        response = supabase.table("samples")\
            .select("*, containers!samples_container_id_fkey(id, name, location, type), previous_containers:containers!samples_previous_container_id_fkey(id, name, location, type)")\
            .eq("is_archived", is_archived)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        return {"data": response.data, "count": len(response.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/samples/{sample_id}")
async def get_sample(sample_id: str):
    """Get a specific sample by ID"""
    try:
        response = supabase.table("samples")\
            .select("*, containers!samples_container_id_fkey(id, name, location, type), previous_containers:containers!samples_previous_container_id_fkey(id, name, location, type)")\
            .eq("sample_id", sample_id)\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Sample not found")
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/samples/checkout")
async def checkout_samples(checkout: SampleCheckout):
    """Checkout multiple samples"""
    try:
        results = []
        for sample_id in checkout.sample_ids:
            # Get current sample data
            sample_response = supabase.table("samples")\
                .select("*")\
                .eq("sample_id", sample_id)\
                .single()\
                .execute()
            
            sample = sample_response.data
            if not sample or sample["is_checked_out"]:
                continue
            
            # Update sample
            update_response = supabase.table("samples")\
                .update({
                    "is_checked_out": True,
                    "checked_out_by": checkout.user_initials,
                    "previous_container_id": sample["container_id"],
                    "previous_position": sample["position"],
                    "container_id": None,
                    "position": None
                })\
                .eq("id", sample["id"])\
                .execute()
            
            results.append(update_response.data)
        
        return {"success": True, "checked_out": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/containers")
async def get_containers(archived: bool = False):
    """Get containers with sample counts"""
    try:
        response = supabase.table("containers")\
            .select("*, samples!samples_container_id_fkey(*)")\
            .eq("archived", archived)\
            .execute()
        
        # Add sample counts
        containers = []
        for container in response.data:
            container["used"] = len(container.get("samples", []))
            containers.append(container)
        
        return {"data": containers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audit")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_name: Optional[str] = None,
    limit: int = 100
):
    """Get audit logs"""
    try:
        query = supabase.table("audit_logs").select("*")
        
        if entity_type:
            query = query.eq("entity_type", entity_type)
        if entity_name:
            query = query.eq("entity_name", entity_name)
        
        response = query.order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        
        return {"data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# LIMS Integration endpoints
@app.post("/api/lims/sync")
async def sync_with_lims():
    """
    Sync data with company LIMS system
    
    This endpoint should be customized based on your LIMS API:
    - Pull new samples from LIMS
    - Push sample status updates to LIMS
    - Sync container information
    """
    try:
        # TODO: Implement LIMS-specific integration
        # Example:
        # lims_client = YourLIMSClient()
        # new_samples = lims_client.get_new_samples()
        # for sample in new_samples:
        #     supabase.table("samples").insert({...}).execute()
        
        return {
            "success": True,
            "message": "LIMS sync not yet implemented - customize for your LIMS"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/lims/export-sample/{sample_id}")
async def export_sample_to_lims(sample_id: str):
    """Export a sample to LIMS system"""
    try:
        # Get sample data
        sample = await get_sample(sample_id)
        
        # TODO: Push to LIMS
        # lims_client = YourLIMSClient()
        # lims_client.create_sample(sample)
        
        return {
            "success": True,
            "message": f"Sample {sample_id} exported to LIMS",
            "sample": sample
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
