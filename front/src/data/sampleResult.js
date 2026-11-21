// A real milp solver response supplied by the user, used for offline preview and display tests.
export const SAMPLE_RESULT = {
  "status": "OPTIMAL",
  "engine": "milp",
  "objective": 410.0,
  "best_bound": 410.0,
  "solve_time_sec": 2.963,
  "assignments": [
    {
      "course_id": "C1",
      "session_index": 0,
      "teacher_id": "T1",
      "day": 0,
      "day_name": "شنبه",
      "start": "08:00",
      "end": "10:00",
      "slot_ids": [
        "d0_08",
        "d0_09"
      ]
    },
    {
      "course_id": "C2",
      "session_index": 0,
      "teacher_id": "T1",
      "day": 0,
      "day_name": "شنبه",
      "start": "10:00",
      "end": "12:00",
      "slot_ids": [
        "d0_10",
        "d0_11"
      ]
    },
    {
      "course_id": "C3",
      "session_index": 0,
      "teacher_id": "T2",
      "day": 1,
      "day_name": "یکشنبه",
      "start": "08:00",
      "end": "10:00",
      "slot_ids": [
        "d1_08",
        "d1_09"
      ]
    },
    {
      "course_id": "C4",
      "session_index": 0,
      "teacher_id": "T2",
      "day": 1,
      "day_name": "یکشنبه",
      "start": "10:00",
      "end": "12:00",
      "slot_ids": [
        "d1_10",
        "d1_11"
      ]
    },
    {
      "course_id": "C8",
      "session_index": 0,
      "teacher_id": "T5",
      "day": 1,
      "day_name": "یکشنبه",
      "start": "10:00",
      "end": "13:00",
      "slot_ids": [
        "d1_10",
        "d1_11",
        "d1_12"
      ]
    },
    {
      "course_id": "C7",
      "session_index": 0,
      "teacher_id": "T4",
      "day": 1,
      "day_name": "یکشنبه",
      "start": "13:00",
      "end": "16:00",
      "slot_ids": [
        "d1_13",
        "d1_14",
        "d1_15"
      ]
    },
    {
      "course_id": "C9",
      "session_index": 0,
      "teacher_id": "T6",
      "day": 2,
      "day_name": "دوشنبه",
      "start": "08:00",
      "end": "11:00",
      "slot_ids": [
        "d2_08",
        "d2_09",
        "d2_10"
      ]
    },
    {
      "course_id": "C5",
      "session_index": 0,
      "teacher_id": "T3",
      "day": 2,
      "day_name": "دوشنبه",
      "start": "09:00",
      "end": "11:00",
      "slot_ids": [
        "d2_09",
        "d2_10"
      ]
    },
    {
      "course_id": "C6",
      "session_index": 0,
      "teacher_id": "T3",
      "day": 2,
      "day_name": "دوشنبه",
      "start": "11:00",
      "end": "13:00",
      "slot_ids": [
        "d2_11",
        "d2_12"
      ]
    },
    {
      "course_id": "C1",
      "session_index": 1,
      "teacher_id": "T1",
      "day": 3,
      "day_name": "سه‌شنبه",
      "start": "08:00",
      "end": "10:00",
      "slot_ids": [
        "d3_08",
        "d3_09"
      ]
    },
    {
      "course_id": "C2",
      "session_index": 1,
      "teacher_id": "T1",
      "day": 3,
      "day_name": "سه‌شنبه",
      "start": "10:00",
      "end": "12:00",
      "slot_ids": [
        "d3_10",
        "d3_11"
      ]
    },
    {
      "course_id": "C6",
      "session_index": 1,
      "teacher_id": "T3",
      "day": 3,
      "day_name": "سه‌شنبه",
      "start": "10:00",
      "end": "12:00",
      "slot_ids": [
        "d3_10",
        "d3_11"
      ]
    },
    {
      "course_id": "C3",
      "session_index": 1,
      "teacher_id": "T2",
      "day": 3,
      "day_name": "سه‌شنبه",
      "start": "12:00",
      "end": "14:00",
      "slot_ids": [
        "d3_12",
        "d3_13"
      ]
    },
    {
      "course_id": "C4",
      "session_index": 1,
      "teacher_id": "T2",
      "day": 3,
      "day_name": "سه‌شنبه",
      "start": "14:00",
      "end": "16:00",
      "slot_ids": [
        "d3_14",
        "d3_15"
      ]
    }
  ],
  "objective_breakdown": {
    "teacher_days": 350,
    "teacher_gaps": 0,
    "course_spread": 5,
    "slot_quality": 35,
    "soft_course_conflicts": 0,
    "total_days": 20
  },
  "metrics": {
    "teachers": {
      "T1": {
        "name": "Mahdian",
        "days_on_campus": 2,
        "days": [
          0,
          3
        ],
        "teaching_hours": 8.0,
        "gap_hours": 0.0
      },
      "T2": {
        "name": "Jafariani",
        "days_on_campus": 2,
        "days": [
          1,
          3
        ],
        "teaching_hours": 8.0,
        "gap_hours": 0.0
      },
      "T6": {
        "name": "Poursadegh",
        "days_on_campus": 1,
        "days": [
          2
        ],
        "teaching_hours": 3.0,
        "gap_hours": 0.0
      },
      "T3": {
        "name": "Sadeghi",
        "days_on_campus": 2,
        "days": [
          2,
          3
        ],
        "teaching_hours": 6.0,
        "gap_hours": 0.0
      },
      "T5": {
        "name": "Askari",
        "days_on_campus": 1,
        "days": [
          1
        ],
        "teaching_hours": 3.0,
        "gap_hours": 0.0
      },
      "T4": {
        "name": "Moradi",
        "days_on_campus": 1,
        "days": [
          1
        ],
        "teaching_hours": 3.0,
        "gap_hours": 0.0
      }
    },
    "days_used_overall": [
      0,
      1,
      2,
      3
    ],
    "total_gap_hours": 0.0,
    "total_teacher_days": 9,
    "engine_stats": {
      "solver": "SCIP",
      "variables": 736,
      "constraints": 2568,
      "nodes": 1
    }
  },
  "issues": [],
  "infeasibility_core": []
}

export function sampleRun() {
  return { name: SAMPLE_RESULT.engine, state: 'success', status: 200, body: structuredClone(SAMPLE_RESULT) }
}
