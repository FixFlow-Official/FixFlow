// Default Campus Layout & Infrastructure for Pt. Chiranjilal Sharma Govt. College, Sector 14, Karnal
module.exports = [
  {
    name: "Administrative Block & Principal Office",
    shortName: "Admin Block",
    code: "ADMIN",
    category: "Administrative",
    accentColor: "indigo",
    floors: [
      {
        name: "Ground Floor",
        rooms: [
          "Principal Office",
          "Establishment Branch",
          "Accounts & Fee Counter",
          "Staff Common Room",
          "Conference Hall",
        ],
      },
    ],
    departments: ["Administration", "Accounts", "Establishment"],
  },
  {
    name: "College Canteen & Cafeteria",
    shortName: "Canteen",
    code: "CANTEEN",
    category: "Amenities",
    accentColor: "amber",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["Main Dining Hall", "Refreshment Counter", "Faculty Lounge"],
      },
    ],
    departments: ["Student Welfare", "Cafeteria"],
  },
  {
    name: "Sports Complex & Gymnasium",
    shortName: "Sports Ground",
    code: "SPORTS",
    category: "Sports",
    accentColor: "emerald",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["Director Physical Education", "Fitness Gym", "Equipment Room", "Changing Room"],
      },
    ],
    departments: ["Physical Education"],
  },
  {
    name: "PG & Arts Block",
    shortName: "PG Block",
    code: "PG-ARTS",
    category: "Academic",
    accentColor: "purple",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["Room 101", "Room 102", "Room 103", "Room 104", "Faculty Cabin Arts"],
      },
      {
        name: "1st Floor",
        rooms: ["Room 201", "Room 202", "Room 203", "Room 204", "Language Lab"],
      },
      {
        name: "2nd Floor",
        rooms: ["PG Seminar Hall", "Room 301 (M.A.)", "Room 302 (M.A.)", "Research Room"],
      },
    ],
    departments: ["Postgraduate", "B.A. Arts", "Humanities"],
  },
  {
    name: "Commerce Block (Block B)",
    shortName: "Commerce Block",
    code: "COMM-B",
    category: "Academic",
    accentColor: "blue",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["Room B-01", "Room B-02", "Room B-03", "HOD Commerce Office"],
      },
      {
        name: "1st Floor",
        rooms: ["Room B-11", "Room B-12", "Room B-13", "Room B-14"],
      },
      {
        name: "2nd Floor",
        rooms: ["Commerce Computer Lab", "Room B-21 (M.Com)", "Room B-22", "Tutorial Room"],
      },
    ],
    departments: ["B.Com", "M.Com", "Business Studies"],
  },
  {
    name: "Science Block & Laboratories",
    shortName: "Science Wing",
    code: "SCI-LABS",
    category: "Lab",
    accentColor: "cyan",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["Chemistry Lab 1", "Chemistry Lab 2", "Botany Lab", "Preparation Room"],
      },
      {
        name: "1st Floor",
        rooms: ["Physics Lab 1 (Optics)", "Physics Lab 2", "Zoology Lab", "Dark Room"],
      },
    ],
    departments: ["Physics", "Chemistry", "Botany", "Zoology"],
  },
  {
    name: "IT & Computer Labs",
    shortName: "Computer Center",
    code: "IT-LABS",
    category: "Lab",
    accentColor: "blue",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["BCA Lab A", "Server Room", "Programming Lab 1", "Hardware Lab"],
      },
      {
        name: "1st Floor",
        rooms: ["BCA Lab B", "Project Work Lab", "Networking Center", "Faculty Cabin IT"],
      },
    ],
    departments: ["BCA", "B.Sc (Computer Science)", "IT"],
  },
  {
    name: "Mass Communication Center",
    shortName: "Media Studio",
    code: "MASS-COMM",
    category: "Academic",
    accentColor: "rose",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["Audio Production Studio", "Video Editing Suite", "Newsroom Lab", "Media Faculty"],
      },
    ],
    departments: ["Mass Communication", "Journalism"],
  },
  {
    name: "Central Library & Reading Hall",
    shortName: "Central Library",
    code: "LIBRARY",
    category: "Amenities",
    accentColor: "emerald",
    floors: [
      {
        name: "Ground Floor",
        rooms: ["Circulation Counter", "Stack Section", "Librarian Cabin", "Periodical Display"],
      },
      {
        name: "1st Floor",
        rooms: ["Boys Reading Hall", "Girls Reading Hall", "Competitive Exam Cell", "E-Library"],
      },
    ],
    departments: ["Library Services", "Reference"],
  },
];
