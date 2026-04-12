# IPO Model Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /api/ipo/evaluate` automatically fall back to the next available AI model when the requested model fails, while keeping the change isolated to the IPO evaluation flow.

**Architecture:** Keep fallback orchestration inside `backend/services/ipo_evaluator.py` so only IPO evaluation behavior changes. Resolve ordered candidate models from database priority records, try them one by one, and return both the requested model and the actual model used to generate the final result.

**Tech Stack:** FastAPI, SQLAlchemy, unittest, LangChain-based AI service factory

---

### Task 1: Define fallback behavior with tests

**Files:**
- Modify: `backend/tests/test_ipo_route.py`
- Test: `backend/tests/test_ipo_route.py`

- [ ] **Step 1: Write the failing test**

```python
    @patch("services.ipo_evaluator.get_ai_service")
    @patch("services.ipo_evaluator.get_ordered_candidate_models")
    @patch("services.ipo_evaluator.get_ds_manager")
    def test_evaluate_ipo_falls_back_to_next_available_model(
        self, get_ds_manager_mock: Mock, get_ordered_candidate_models_mock: Mock, get_ai_service_mock: Mock
    ) -> None:
        ...
        self.assertEqual(result["requested_model"], "minimax")
        self.assertEqual(result["actual_model"], "zhipu")
        self.assertTrue(result["fallback_used"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_ipo_route.IPOEvaluatorServiceTests.test_evaluate_ipo_falls_back_to_next_available_model -v`
Expected: FAIL because fallback metadata and retry behavior do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
def get_ordered_candidate_models(requested_model: str) -> list[str]:
    ...

def _evaluate_with_model_fallback(...):
    ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_ipo_route.IPOEvaluatorServiceTests.test_evaluate_ipo_falls_back_to_next_available_model -v`
Expected: PASS

### Task 2: Expose fallback metadata in IPO response

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routers/ipo.py`
- Modify: `backend/tests/test_ipo_route.py`
- Test: `backend/tests/test_ipo_route.py`

- [ ] **Step 1: Write the failing test**

```python
        self.assertEqual(payload["requested_model"], "minimax")
        self.assertEqual(payload["actual_model"], "zhipu")
        self.assertTrue(payload["fallback_used"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_ipo_route.IPORouteTests.test_post_evaluate_returns_frontend_compatible_data_sources -v`
Expected: FAIL because response model does not include fallback fields.

- [ ] **Step 3: Write minimal implementation**

```python
class IPOEvaluationResponse(BaseModel):
    ...
    requested_model: str
    actual_model: str
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_ipo_route.IPORouteTests.test_post_evaluate_returns_frontend_compatible_data_sources -v`
Expected: PASS

### Task 3: Verify regression coverage

**Files:**
- Test: `backend/tests/test_ipo_route.py`

- [ ] **Step 1: Run targeted IPO tests**

Run: `python -m unittest tests.test_ipo_route -v`
Expected: PASS

- [ ] **Step 2: Run related model config tests**

Run: `python -m unittest tests.test_ai_runtime_config tests.test_model_routes -v`
Expected: PASS
