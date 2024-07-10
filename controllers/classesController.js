const asyncHandler = require("express-async-handler");
const moment = require("moment");
const mongoose = require("mongoose");

const { createMeeting, deleteMeeting } = require("../utils/zoom");
const ApiError = require("../utils/ApiError");
const classModel = require("../models/classModel");
const checkInOutModel = require("../models/classCheckIn-OutModel");
const userModel = require("../models/userModel");
const Notification = require("../models/notificationModel");
const sendEmail = require("../utils/sendEmails");
const { getIO } = require("../socketConfig");
const { decryptField } = require("../utils/encryption");

const classNotify = async (array, message, classId) => {
  // Send notifications to added students
  const studentsNotification = await Promise.all(
    array.map(async (studentId) => {
      return await Notification.create({
        scope: "class",
        userId: studentId,
        relatedId: classId,
        message,
      });
    })
  );

  // Emit notifications students
  const { io, users } = getIO();
  if (users.length > 0) {
    const connectedStudents = users.filter((user) =>
      array.includes(user.userId)
    );

    connectedStudents.forEach((student) => {
      const studentNotification = studentsNotification.find(
        (notification) =>
          notification.userId.toString() === student.userId.toString()
      );

      if (studentNotification) {
        const { userId, scope, message, _id, createdAt } = studentNotification;
        io.to(student.socketId).emit("notification", {
          userId,
          scope,
          classId,
          message,
          _id,
          createdAt,
        });
      }
    });
  }
};

exports.createClass = asyncHandler(async (req, res, next) => {
  try {
    const { name, duration, start_date, start_time, teacher, students } =
      req.body;

    // Check if the teacher exists
    const teacherExists = await userModel.findOne({ _id: teacher });
    if (!teacherExists) {
      return res.status(400).json({ message: "Teacher not found" });
    }

    const teacherTimezone = teacherExists.timezone;

    let decryptedZoomAccountId;
    let decryptedZoomClientId;
    let decryptedZoomClientSecret;

    // Decrypt Zoom credentials
    if (
      teacherExists.zoom_account_id !== "" &&
      teacherExists.zoom_account_id !== null &&
      teacherExists.zoom_account_id !== undefined
    ) {
      decryptedZoomAccountId = decryptField(teacherExists.zoom_account_id);
    } else {
      return next(
        new ApiError(`No zoom_account_id provided for this teacher`, 400)
      );
    }

    if (
      teacherExists.zoom_client_id !== "" &&
      teacherExists.zoom_client_id !== null &&
      teacherExists.zoom_client_id !== undefined
    ) {
      decryptedZoomClientId = decryptField(teacherExists.zoom_client_id);
    } else {
      return next(
        new ApiError(`No zoom_client_id provided for this teacher`, 400)
      );
    }

    if (
      teacherExists.zoom_client_Secret !== "" &&
      teacherExists.zoom_client_Secret !== null &&
      teacherExists.zoom_client_Secret !== undefined
    ) {
      decryptedZoomClientSecret = decryptField(
        teacherExists.zoom_client_Secret
      );
    } else {
      return next(
        new ApiError(`No zoom_client_Secret provided for this teacher`, 400)
      );
    }

    // Check if all students exist and have remaining classes greater than 0
    const invalidStudents = [];

    for (const studentId of students) {
      const studentExists = await userModel.exists({
        _id: studentId,
        remainingClasses: { $gt: 0 },
      });

      if (!studentExists) {
        invalidStudents.push(studentId);
      }
    }

    if (invalidStudents.length > 0) {
      return res.status(400).json({
        message: "Some students do not exist or do not have remaining classes",
        invalidStudents,
      });
    }

    // Combine start_date and start_time to form a datetime string
    const datetimeString = `${start_date} ${start_time}`;

    // Parse the datetime string using moment-timezone and user's timezone
    const userLocalTime = moment.tz(
      datetimeString,
      "DD-MM-YYYY h:mm A",
      teacherTimezone
    );

    // Convert the user's local time to UTC
    const utcTime = userLocalTime.utc().format("YYYY-MM-DDTHH:mm:ss[Z]");

    // Create a Zoom meeting
    const meeting = await createMeeting(
      name,
      duration,
      new Date(utcTime),
      decryptedZoomAccountId,
      decryptedZoomClientId,
      decryptedZoomClientSecret
    );

    const formattedTime = moment(meeting.meetingTime).utc().format("hh:mm A");

    const formattedDate = moment(meeting.meetingTime)
      .utc()
      .format("DD/MM/YYYY");

    // Create a new class document
    const classInfo = await classModel.create({
      name,
      start_date: formattedDate,
      start_time: formattedTime,
      meeting_time: meeting.meetingTime,
      duration,
      zoomMeetingId: meeting.meetingId,
      classZoomLink: meeting.meeting_url,
      meetingPassword: meeting.password,
      teacher,
      studentsEnrolled: students,
      // Automatically generate attendance for enrolled students
      attendance: students.map((studentId) => ({
        student: studentId,
        attended: false,
      })),
    });

    // Send email to teacher
    if (classInfo.teacher) {
      const meetingTimeInTeacherTimezone = moment.tz(
        meeting.meetingTime,
        "DD-MM-YYYY h:mm A",
        teacherTimezone
      );
      const teacherFormattedTime = moment(meetingTimeInTeacherTimezone).format(
        "hh:mm A"
      );

      const teacherFormattedDate = moment(meetingTimeInTeacherTimezone).format(
        "DD/MM/YYYY"
      );

      let capitalizeFirstLetterOfName =
        teacherExists.name.split(" ")[0].charAt(0).toUpperCase() +
        teacherExists.name.split(" ")[0].slice(1).toLocaleLowerCase();

      let img =
        "https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png";

      let emailTamplate = `<!DOCTYPE html>
      <html lang="en-US">
        <head>
          <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
          <title>Your remaining classes credit is running out</title>
          <meta name="description" content="Your remaining classes credit is running out" />
          <style type="text/css">
            a:hover {
              text-decoration: underline !important;
            }
          </style>
        </head>
      
        <body
          marginheight="0"
          topmargin="0"
          marginwidth="0"
          style="margin: 0px; background-color: #f2f3f8"
          leftmargin="0"
        >
          <!--100% body table-->
          <table
            cellspacing="0"
            border="0"
            cellpadding="0"
            width="100%"
            bgcolor="#f2f3f8"
            style="
              @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
              font-family: 'Open Sans', sans-serif;
            "
          >
            <tr>
              <td>
                <table
                  style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
                  width="100%"
                  border="0"
                  align="center"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td style="height: 80px">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="text-align: center">
                      <a
                        href="https://learning.jawwid.com"
                        title="logo"
                        target="_blank"
                      >
                        <img width="250" src="${img}" title="logo" alt="logo" />
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="height: 20px">&nbsp;</td>
                  </tr>
                  <tr>
                    <td>
                      <table
                        width="95%"
                        border="0"
                        align="center"
                        cellpadding="0"
                        cellspacing="0"
                        style="
                          max-width: 670px;
                          background: #fff;
                          border-radius: 3px;
                          text-align: center;
                          -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                          -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                          box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                        "
                      >
                        <tr>
                          <td style="height: 40px">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="padding: 0 35px">
                            <span
                              style="
                                display: inline-block;
                                vertical-align: middle;
                                margin: 29px 0 26px;
                                border-bottom: 1px solid #cecece;
                                width: 200px;
                              "
                            ></span>
                            <p
                              style="
                                color: #455056;
                                font-size: 17px;
                                line-height: 24px;
                                text-align: left;
                              "
                            >
                              Hello ${capitalizeFirstLetterOfName},
                            </p>
                            <p
                              style="
                                color: #455056;
                                font-size: 17px;
                                line-height: 24px;
                                text-align: left;
                              "
                            >
                            We hope you are enjoying your time on Jawwid.<br>
                            You have been assigned to be the teacher of class: ${classInfo.name}<br>
                            Class will start on ${classInfo.start_date} at ${classInfo.start_time} (as UTC time)<br>
                            and on ${teacherFormattedDate} at ${teacherFormattedTime} (as ${teacherTimezone} time)<br>
                            Meeting link: ${classInfo.classZoomLink}<br>
                            Meeting password: ${classInfo.meetingPassword}
                            <br>
                            Please make sure to start the meeting on time.
                          </p>
                            
      
                            <br>
                            <p
                              style="
                                margin-top: 3px;
                                color: #455056;
                                font-size: 17px;
                                line-height: 2px;
                                text-align: left;
                              "
                            >
                              The Jawwid Team.
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="height: 40px">&nbsp;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
      
                  <tr>
                    <td style="height: 20px">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="text-align: center">
                      <p
                        style="
                          font-size: 14px;
                          color: rgba(69, 80, 86, 0.7411764705882353);
                          line-height: 18px;
                          margin: 0 0 0;
                        "
                      >
                        &copy; <strong>https://learning.jawwid.com</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="height: 80px">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!--/100% body table-->
        </body>
      </html>`;

      try {
        await sendEmail({
          email: teacherExists.email,
          subject: `${capitalizeFirstLetterOfName}, You have been assigned to class ${classInfo.name}`,
          message: emailTamplate,
        });
        console.log("Email sent");
      } catch (error) {
        console.log(error);
      }
    }

    const populatedClass = await classInfo.populate(
      "studentsEnrolled",
      "name email phone timezone"
    );

    // Send emails to students enrolled
    if (populatedClass.studentsEnrolled) {
      populatedClass.studentsEnrolled.forEach(async (student) => {
        studentTimezone = student.timezone;
        const meetingTimeInStudentTimezone = moment.tz(
          meeting.meetingTime,
          "DD-MM-YYYY h:mm A",
          studentTimezone
        );
        const studentFormattedTime = moment(
          meetingTimeInStudentTimezone
        ).format("hh:mm A");

        const studentFormattedDate = moment(
          meetingTimeInStudentTimezone
        ).format("DD/MM/YYYY");

        let capitalizeFirstLetterOfName =
          student.name.split(" ")[0].charAt(0).toUpperCase() +
          student.name.split(" ")[0].slice(1).toLocaleLowerCase();

        let img =
          "https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png";

        let emailTamplate = `<!DOCTYPE html>
            <html lang="en-US">
              <head>
                <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
                <title>You have been added to class</title>
                <meta name="description" content="You have been added to class" />
                <style type="text/css">
                  a:hover {
                    text-decoration: underline !important;
                  }
                </style>
              </head>
            
              <body
                marginheight="0"
                topmargin="0"
                marginwidth="0"
                style="margin: 0px; background-color: #f2f3f8"
                leftmargin="0"
              >
                <!--100% body table-->
                <table
                  cellspacing="0"
                  border="0"
                  cellpadding="0"
                  width="100%"
                  bgcolor="#f2f3f8"
                  style="
                    @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
                    font-family: 'Open Sans', sans-serif;
                  "
                >
                  <tr>
                    <td>
                      <table
                        style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
                        width="100%"
                        border="0"
                        align="center"
                        cellpadding="0"
                        cellspacing="0"
                      >
                        <tr>
                          <td style="height: 80px">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="text-align: center">
                            <a
                              href="https://learning.jawwid.com"
                              title="logo"
                              target="_blank"
                            >
                              <img width="250" src="${img}" title="logo" alt="logo" />
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style="height: 20px">&nbsp;</td>
                        </tr>
                        <tr>
                          <td>
                            <table
                              width="95%"
                              border="0"
                              align="center"
                              cellpadding="0"
                              cellspacing="0"
                              style="
                                max-width: 670px;
                                background: #fff;
                                border-radius: 3px;
                                text-align: center;
                                -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                              "
                            >
                              <tr>
                                <td style="height: 40px">&nbsp;</td>
                              </tr>
                              <tr>
                                <td style="padding: 0 35px">
                                  <span
                                    style="
                                      display: inline-block;
                                      vertical-align: middle;
                                      margin: 29px 0 26px;
                                      border-bottom: 1px solid #cecece;
                                      width: 200px;
                                    "
                                  ></span>
                                  <p
                                    style="
                                      color: #455056;
                                      font-size: 17px;
                                      line-height: 24px;
                                      text-align: left;
                                    "
                                  >
                                    Hello ${capitalizeFirstLetterOfName},
                                  </p>
                                  <p
                                    style="
                                      color: #455056;
                                      font-size: 17px;
                                      line-height: 24px;
                                      text-align: left;
                                    "
                                  >
                                  We hope you are enjoying your time on Jawwid.<br>
                                  You have been added to class: ${classInfo.name}<br>
                                  Class will start on ${classInfo.start_date} at ${classInfo.start_time} (as UTC time)<br>
                                  and on ${studentFormattedDate} at ${studentFormattedTime} (as ${studentTimezone} time)<br>
                                  Meeting link: ${classInfo.classZoomLink}<br>
                                  Meeting password: ${classInfo.meetingPassword}
                                  <br>
                                  Please make sure to join the meeting on time.
                            </p>
                                  
            
                                  <br>
                                  <p
                                    style="
                                      margin-top: 3px;
                                      color: #455056;
                                      font-size: 17px;
                                      line-height: 2px;
                                      text-align: left;
                                    "
                                  >
                                    The Jawwid Team.
                                  </p>
                                </td>
                              </tr>
                              <tr>
                                <td style="height: 40px">&nbsp;</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
            
                        <tr>
                          <td style="height: 20px">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="text-align: center">
                            <p
                              style="
                                font-size: 14px;
                                color: rgba(69, 80, 86, 0.7411764705882353);
                                line-height: 18px;
                                margin: 0 0 0;
                              "
                            >
                              &copy; <strong>https://learning.jawwid.com</strong>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="height: 80px">&nbsp;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <!--/100% body table-->
              </body>
            </html>`;

        try {
          await sendEmail({
            email: student.email,
            subject: `${capitalizeFirstLetterOfName}, You have been added to class ${classInfo.name}`,
            message: emailTamplate,
          });
          console.log("Email sent");
        } catch (error) {
          console.log(error);
        }
      });
    }

    const teacherNotification = await Notification.create({
      scope: "class",
      userId: teacher,
      relatedId: classInfo._id,
      message: `you have been assigned to class ${name}`,
    });

    const studentsNotification = await Promise.all(
      students.map(async (studentId) => {
        return await Notification.create({
          scope: "class",
          userId: studentId,
          relatedId: classInfo._id,
          message: `You have been enrolled in a new class: ${name}`,
        });
      })
    );

    // Emit notifications to teacher and students
    const { io, users } = getIO();

    if (users.length > 0) {
      const connectedTeacher = users.find(
        (user) => user.userId.toString() === teacher.toString()
      );
      const connectedStudents = users.filter((user) =>
        students.includes(user.userId)
      );

      if (connectedTeacher) {
        const { userId, scope, message, relatedId, _id, createdAt } =
          teacherNotification;
        io.to(connectedTeacher.socketId).emit("notification", {
          userId,
          scope,
          classId: relatedId,
          message,
          _id,
          createdAt,
        });
      }

      connectedStudents.forEach((student) => {
        const studentNotification = studentsNotification.find(
          (notification) =>
            notification.userId.toString() === student.userId.toString()
        );

        if (studentNotification) {
          const { userId, scope, message, _id, createdAt } =
            studentNotification;
          io.to(student.socketId).emit("notification", {
            userId,
            scope,
            message,
            _id,
            createdAt,
          });
        }
      });
    }

    res.status(200).json({
      message: "Success",
      class: classInfo,
      meetingInfo: meeting,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

exports.getAllClasses = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { page, limit, skip, ...query } = req.query;

  const pageNum = page * 1 || 1;
  const limitNum = limit * 1 || 5;
  const skipNum = (pageNum - 1) * limit;

  // Modify the filter to support partial matches for string fields
  Object.keys(query).forEach((key) => {
    if (typeof query[key] === "string") {
      filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
    } else {
      filter[key] = query[key];
    }
  });

  if (req.user.role === "student") {
    const totalClassesCount = await classModel.countDocuments({
      studentsEnrolled: { $in: [req.user._id] },
      ...filter,
    });
    const totalPages = Math.ceil(totalClassesCount / limitNum);

    if (req.user.remainingClasses <= 2) {
      let capitalizeFirstLetterOfName =
        req.user.name.split(" ")[0].charAt(0).toUpperCase() +
        req.user.name.split(" ")[0].slice(1).toLocaleLowerCase();

      let img =
        "https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png";

      let emailTamplate = `<!DOCTYPE html>
      <html lang="en-US">
        <head>
          <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
          <title>Your remaining classes credit is running out</title>
          <meta name="description" content="Your remaining classes credit is running out" />
          <style type="text/css">
            a:hover {
              text-decoration: underline !important;
            }
          </style>
        </head>
      
        <body
          marginheight="0"
          topmargin="0"
          marginwidth="0"
          style="margin: 0px; background-color: #f2f3f8"
          leftmargin="0"
        >
          <!--100% body table-->
          <table
            cellspacing="0"
            border="0"
            cellpadding="0"
            width="100%"
            bgcolor="#f2f3f8"
            style="
              @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
              font-family: 'Open Sans', sans-serif;
            "
          >
            <tr>
              <td>
                <table
                  style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
                  width="100%"
                  border="0"
                  align="center"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td style="height: 80px">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="text-align: center">
                      <a
                        href="https://learning.jawwid.com"
                        title="logo"
                        target="_blank"
                      >
                        <img width="250" src="${img}" title="logo" alt="logo" />
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="height: 20px">&nbsp;</td>
                  </tr>
                  <tr>
                    <td>
                      <table
                        width="95%"
                        border="0"
                        align="center"
                        cellpadding="0"
                        cellspacing="0"
                        style="
                          max-width: 670px;
                          background: #fff;
                          border-radius: 3px;
                          text-align: center;
                          -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                          -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                          box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                        "
                      >
                        <tr>
                          <td style="height: 40px">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="padding: 0 35px">
                            <span
                              style="
                                display: inline-block;
                                vertical-align: middle;
                                margin: 29px 0 26px;
                                border-bottom: 1px solid #cecece;
                                width: 200px;
                              "
                            ></span>
                            <p
                              style="
                                color: #455056;
                                font-size: 17px;
                                line-height: 24px;
                                text-align: left;
                              "
                            >
                              Hello ${capitalizeFirstLetterOfName},
                            </p>
                            <p
                              style="
                                color: #455056;
                                font-size: 17px;
                                line-height: 24px;
                                text-align: left;
                              "
                            >
                            We hope you are enjoying your time on Jawwid.<br>
                            We want to remind you that your remaining classs credit is: <strong>${req.user.remainingClasses}</strong>. <br>Please make sure to renew your class package to continue enjoying our services and making progress towards your learning goals. <br>
                            If you have any questions or need further assistance, feel free to reach out to our support team
                            </p>
                            
      
                            <br>
                            <p
                              style="
                                margin-top: 3px;
                                color: #455056;
                                font-size: 17px;
                                line-height: 2px;
                                text-align: left;
                              "
                            >
                              The Jawwid Team.
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="height: 40px">&nbsp;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
      
                  <tr>
                    <td style="height: 20px">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="text-align: center">
                      <p
                        style="
                          font-size: 14px;
                          color: rgba(69, 80, 86, 0.7411764705882353);
                          line-height: 18px;
                          margin: 0 0 0;
                        "
                      >
                        &copy; <strong>https://learning.jawwid.com</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="height: 80px">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!--/100% body table-->
        </body>
      </html>
      `;

      try {
        await sendEmail({
          email: req.user.email,
          subject: `${capitalizeFirstLetterOfName}, Your remaining classes credit is running out`,
          message: emailTamplate,
        });
        console.log("Email sent");
      } catch (error) {
        console.log(error);
      }
    }

    const documents = await classModel
      .find({
        studentsEnrolled: { $in: [req.user._id] },
        ...filter,
      })
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  } else if (req.user.role === "teacher") {
    const totalClassesCount = await classModel.countDocuments({
      teacher: req.user._id,
      ...filter,
    });
    const totalPages = Math.ceil(totalClassesCount / limitNum);

    const documents = await classModel
      .find({ teacher: req.user._id, ...filter })
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  } else {
    const totalClassesCount = await classModel.countDocuments(filter);
    const totalPages = Math.ceil(totalClassesCount / limitNum);

    const documents = await classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("studentsEnrolled", "_id name email phone")
      .populate("teacher", "_id name email phone")
      .populate("assignments", "-__v")
      .populate("attendance.student", "_id name email")
      .skip(skipNum)
      .limit(limitNum);

    res.status(200).json({
      totalPages,
      page: pageNum,
      results: documents.length,
      data: documents,
    });
  }
});

exports.getAllClassesByMonthYear = asyncHandler(async (req, res, next) => {
  let filter = {};
  const { month, year, ...query } = req.query;

  // Modify the filter to support partial matches for string fields
  Object.keys(query).forEach((key) => {
    if (typeof query[key] === "string") {
      filter[key] = { $regex: query[key], $options: "i" }; // Case-insensitive partial match
    } else {
      filter[key] = query[key];
    }
  });
  // Add month and year filtering to the filter object
  if (month && year) {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    filter.start_date = {
      $regex: `${monthNum.toString().padStart(2, "0")}/${yearNum}`,
    };
  }

  const role = req.user.role;
  let baseFilter = {};

  if (role === "student") {
    baseFilter.studentsEnrolled = { $in: [req.user._id] };
  } else if (role === "teacher") {
    baseFilter.teacher = req.user._id;
  }

  const documents = await classModel
    .find({ ...baseFilter, ...filter })
    .sort({ createdAt: -1 })
    .populate("studentsEnrolled", "_id name email phone")
    .populate("teacher", "_id name email phone")
    .populate("assignments", "-__v")
    .populate("attendance.student", "_id name email");

  res.status(200).json({
    results: documents.length,
    data: documents,
  });
});

exports.getClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const document = await classModel
    .findById(id)
    .populate("studentsEnrolled", "_id name email phone")
    .populate("studentsEnrolled", "_id name email phone")
    .populate("teacher", "_id name email phone")
    .populate("attendance.student", "_id name email");

  if (!document) {
    return next(new ApiError(`No document found for this id:${id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.updateClass = asyncHandler(async (req, res, next) => {
  const { name, status } = req.body;
  const document = await classModel.findByIdAndUpdate(
    req.params.id,
    { name, status },
    {
      new: true,
    }
  );

  if (!document) {
    return next(new ApiError(`No document for this id:${req.params.id}`, 404));
  }
  res.status(200).json({ data: document });
});

exports.deleteClass = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const Document = await classModel.findOne({ _id: id }).populate("teacher");
  if (!Document) {
    return next(new ApiError(`No Class found for this id:${id}`, 404));
  }

  // Decrypt Zoom credentials
  const decryptedZoomAccountId = decryptField(Document.teacher.zoom_account_id);
  const decryptedZoomClientId = decryptField(Document.teacher.zoom_client_id);
  const decryptedZoomClientSecret = decryptField(
    Document.teacher.zoom_client_Secret
  );

  // Delete the Zoom meeting associated with the class
  const { zoomMeetingId } = Document;
  if (zoomMeetingId) {
    // Call deleteMeeting function and pass the meetingId
    await deleteMeeting(
      zoomMeetingId,
      decryptedZoomAccountId,
      decryptedZoomClientId,
      decryptedZoomClientSecret
    );
  }

  await classModel.findOneAndDelete({ _id: id });

  classNotify(
    Document.studentsEnrolled,
    `Class: ${Document.name} has been deleted.`
  );

  res.status(204).send("Class deleted successfully");
});

exports.classReport = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { attendance, classComment } = req.body;

  // Find the class by ID
  const cls = await classModel.findById(classId);

  if (!cls) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  cls.comment = classComment;
  cls.status = "ended";

  // Update attendance based on the request body
  for (const attendanceEntry of attendance) {
    const { studentId, attended, comment } = attendanceEntry;

    // Find the corresponding attendance entry in the class document
    const existingAttendanceIndex = cls.attendance.findIndex(
      (entry) => entry.student.toString() === studentId
    );

    if (existingAttendanceIndex !== -1) {
      // If the attendance entry exists, update it
      cls.attendance[existingAttendanceIndex].attended = attended;

      // Add comment based on attendance
      if (comment) {
        cls.attendance[existingAttendanceIndex].comment = comment;
      }

      // If the student attended, deduct 1 from remainingClasses using the middleware
      if (attended) {
        const student = await userModel.findById(studentId);
        if (student.remainingClasses > 0) {
          const deductionSuccessful = student.deductClassCredit();
          if (deductionSuccessful) {
            // If deduction was successful, save the updated user
            await student.save();
          } else {
            return next(
              new ApiError(
                `No remaining class credits for student ${studentId}`
              )
            );
          }
        } else {
          return next(
            new ApiError(`No remaining class credits for student ${studentId}`)
          );
        }
      }
    } else {
      return next(
        new ApiError(`Attendance entry for student ${studentId} not found`)
      );
    }
  }

  // Save the updated class
  await cls.save();

  res.status(200).json({ message: "class report updated successfully" });
});

exports.cancelClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;

  // Find the class by ID
  const cls = await classModel.findById(classId);

  if (!cls) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  // Check if the class is already ended or cancelled
  if (cls.status !== "scheduled") {
    return next(
      new ApiError(
        `Can't cancel a class that is already ended or cancelled`,
        400
      )
    );
  }

  // Delete the Zoom meeting associated with the class
  const { zoomMeetingId } = cls;
  if (zoomMeetingId) {
    // Call deleteMeeting function and pass the meetingId
    await deleteMeeting(zoomMeetingId);
  }

  // Update the class status to "cancelled"
  cls.status = "cancelled";
  await cls.save();

  classNotify(cls.studentsEnrolled, `Class: ${cls.name} has been cancelled.`);

  res.status(200).json({ message: "Class cancelled successfully" });
});

exports.addStudentsToClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the class by ID
    const classes = await classModel.findById(classId);
    if (!classes) {
      return next(new ApiError(`No class found for this id:${classId}`, 404));
    }

    if (classes.status !== "scheduled") {
      return next(
        new ApiError(`Can't add students to ${classes.status} classes`, 500)
      );
    }

    // Clear studentsEnrolled array and remove class from students' classes field if studentIds array is empty
    if (!studentIds || studentIds.length === 0) {
      await userModel.updateMany(
        { classes: classId },
        { $pull: { classes: classId } },
        { multi: true }
      );
      const updatedClass = await classModel.findOneAndUpdate(
        { _id: classId },
        { studentsEnrolled: studentIds }, // Clear studentsEnrolled array
        { new: true }
      );
      return res
        .status(200)
        .json({ message: "Class updated successfully", updatedClass });
    }

    // Find the students by IDs
    const students = await userModel.find({
      _id: { $in: studentIds },
      role: "student",
    });

    // Check if all students were found
    if (students.length !== studentIds.length) {
      const missingStudents = studentIds.filter(
        (id) => !students.map((student) => student._id.toString()).includes(id)
      );
      return next(
        new ApiError(
          `Students not found with IDs: ${missingStudents.join(", ")}`,
          404
        )
      );
    }

    // Filter students to identify those with remainingClasses > 0
    const eligibleStudents = students.filter(
      (student) => student.remainingClasses > 0
    );
    const ineligibleStudents = students.filter(
      (student) => student.remainingClasses <= 0
    );

    if (ineligibleStudents.length > 0) {
      return res.status(400).json({
        message:
          "Some students do not have enough remaining classes to be added to the class.",
        ineligibleStudents: ineligibleStudents.map((student) => ({
          _id: student._id.toString(),
          name: student.name,
          email: student.email,
        })),
      });
    }

    // Remove all existing students from the class
    await userModel.updateMany(
      { _id: { $in: classes.studentsEnrolled } },
      { $pull: { classes: classId } },
      { multi: true }
    );

    // Add the new student IDs to the studentsEnrolled array of the class
    const updatedClass = await classModel
      .findOneAndUpdate(
        { _id: classId },
        { studentsEnrolled: studentIds },
        { new: true }
      )
      .populate("studentsEnrolled", "name email phone");

    // Add the class ID to the classes array of each student
    await userModel.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { classes: classId } }
    );

    // Emit notifications to students
    classNotify(
      studentIds,
      `You have been enrolled in class: ${classes.name}`,
      classId
    );
    // Send emails to students enrolled
    if (updatedClass) {
      updatedClass.studentsEnrolled.forEach(async (student) => {
        let capitalizeFirstLetterOfName =
          student.name.split(" ")[0].charAt(0).toUpperCase() +
          student.name.split(" ")[0].slice(1).toLocaleLowerCase();

        let img =
          "https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png";

        let emailTamplate = `<!DOCTYPE html>
                <html lang="en-US">
                  <head>
                    <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
                    <title>You have been added to class</title>
                    <meta name="description" content="You have been added to class" />
                    <style type="text/css">
                      a:hover {
                        text-decoration: underline !important;
                      }
                    </style>
                  </head>
                
                  <body
                    marginheight="0"
                    topmargin="0"
                    marginwidth="0"
                    style="margin: 0px; background-color: #f2f3f8"
                    leftmargin="0"
                  >
                    <!--100% body table-->
                    <table
                      cellspacing="0"
                      border="0"
                      cellpadding="0"
                      width="100%"
                      bgcolor="#f2f3f8"
                      style="
                        @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
                        font-family: 'Open Sans', sans-serif;
                      "
                    >
                      <tr>
                        <td>
                          <table
                            style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
                            width="100%"
                            border="0"
                            align="center"
                            cellpadding="0"
                            cellspacing="0"
                          >
                            <tr>
                              <td style="height: 80px">&nbsp;</td>
                            </tr>
                            <tr>
                              <td style="text-align: center">
                                <a
                                  href="https://learning.jawwid.com"
                                  title="logo"
                                  target="_blank"
                                >
                                  <img width="250" src="${img}" title="logo" alt="logo" />
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td style="height: 20px">&nbsp;</td>
                            </tr>
                            <tr>
                              <td>
                                <table
                                  width="95%"
                                  border="0"
                                  align="center"
                                  cellpadding="0"
                                  cellspacing="0"
                                  style="
                                    max-width: 670px;
                                    background: #fff;
                                    border-radius: 3px;
                                    text-align: center;
                                    -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                    -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                    box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                  "
                                >
                                  <tr>
                                    <td style="height: 40px">&nbsp;</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 0 35px">
                                      <span
                                        style="
                                          display: inline-block;
                                          vertical-align: middle;
                                          margin: 29px 0 26px;
                                          border-bottom: 1px solid #cecece;
                                          width: 200px;
                                        "
                                      ></span>
                                      <p
                                        style="
                                          color: #455056;
                                          font-size: 17px;
                                          line-height: 24px;
                                          text-align: left;
                                        "
                                      >
                                        Hello ${capitalizeFirstLetterOfName},
                                      </p>
                                      <p
                                        style="
                                          color: #455056;
                                          font-size: 17px;
                                          line-height: 24px;
                                          text-align: left;
                                        "
                                      >
                                      We hope you are enjoying your time on Jawwid.<br>
                                      <br>
                                      You have been added to class: ${updatedClass.name}<br>
                                      Class will start on ${updatedClass.start_date} at ${updatedClass.start_time}<br>
                                      Meeting link: ${updatedClass.classZoomLink}<br>
                                      Meeting password: ${updatedClass.meetingPassword}
                                      <br>
                                      Please make sure to join the meeting on time.
                                    </p>
                                      
                
                                      <br>
                                      <p
                                        style="
                                          margin-top: 3px;
                                          color: #455056;
                                          font-size: 17px;
                                          line-height: 2px;
                                          text-align: left;
                                        "
                                      >
                                        The Jawwid Team.
                                      </p>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="height: 40px">&nbsp;</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                
                            <tr>
                              <td style="height: 20px">&nbsp;</td>
                            </tr>
                            <tr>
                              <td style="text-align: center">
                                <p
                                  style="
                                    font-size: 14px;
                                    color: rgba(69, 80, 86, 0.7411764705882353);
                                    line-height: 18px;
                                    margin: 0 0 0;
                                  "
                                >
                                  &copy; <strong>https://learning.jawwid.com</strong>
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="height: 80px">&nbsp;</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <!--/100% body table-->
                  </body>
                </html>`;

        try {
          await sendEmail({
            email: student.email,
            subject: `${capitalizeFirstLetterOfName}, You have been added to class ${updatedClass.name}`,
            message: emailTamplate,
          });
          console.log("Email sent");
        } catch (error) {
          console.log(error);
        }
      });
    }

    res
      .status(200)
      .json({ message: "Students added to class successfully", updatedClass });
  } catch (error) {
    console.error("Error adding students to class:", error);
    next(error);
  }
});

exports.removeStudentFromClass = asyncHandler(async (req, res, next) => {
  const classId = req.params.id;
  const { studentIds } = req.body;

  try {
    // Find the class by ID
    const classes = await classModel.findById(classId);
    if (!classes) {
      return next(new ApiError(`No class found for this id:${classId}`, 404));
    }

    if (classes.status !== "scheduled") {
      return next(
        new ApiError(
          `Can't remove students from ${classes.status} classes`,
          500
        )
      );
    }

    // Check if provided student IDs match any enrolled students in the class
    const enrolledStudents = classes.studentsEnrolled.map((id) =>
      id.toString()
    );
    const invalidStudentIds = studentIds.filter(
      (id) => !enrolledStudents.includes(id.toString())
    );

    // If any invalid student IDs found, return an error
    if (invalidStudentIds.length > 0) {
      return next(
        new ApiError(
          `Students with IDs ${invalidStudentIds.join(
            ", "
          )} are not enrolled in the class`,
          400
        )
      );
    }

    // Find the students by IDs
    const students = await userModel.find({
      _id: { $in: studentIds },
      role: "student",
    });

    // Remove the class ID from the classes array of each student
    students.forEach((student) => {
      const index = student.classes.indexOf(classId);
      if (index !== -1) {
        student.classes.splice(index, 1);
      }
    });

    // Save all updated students
    await Promise.all(students.map((student) => student.save()));

    // Remove the student IDs from the studentsEnrolled array of the class
    classes.studentsEnrolled = classes.studentsEnrolled.filter(
      (id) => !studentIds.includes(id.toString())
    );

    // Send emails to students removed from the class
    if (students) {
      students.forEach(async (student) => {
        let capitalizeFirstLetterOfName =
          student.name.split(" ")[0].charAt(0).toUpperCase() +
          student.name.split(" ")[0].slice(1).toLocaleLowerCase();

        let img =
          "https://user.jawwid.com/resize/resized/200x60/uploads/company/picture/33387/JawwidLogo.png";

        let emailTamplate = `<!DOCTYPE html>
                    <html lang="en-US">
                      <head>
                        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
                        <title>You have been removed from class</title>
                        <meta name="description" content="You have been removed from class" />
                        <style type="text/css">
                          a:hover {
                            text-decoration: underline !important;
                          }
                        </style>
                      </head>
                    
                      <body
                        marginheight="0"
                        topmargin="0"
                        marginwidth="0"
                        style="margin: 0px; background-color: #f2f3f8"
                        leftmargin="0"
                      >
                        <!--100% body table-->
                        <table
                          cellspacing="0"
                          border="0"
                          cellpadding="0"
                          width="100%"
                          bgcolor="#f2f3f8"
                          style="
                            @import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700);
                            font-family: 'Open Sans', sans-serif;
                          "
                        >
                          <tr>
                            <td>
                              <table
                                style="background-color: #f2f3f8; max-width: 670px; margin: 0 auto"
                                width="100%"
                                border="0"
                                align="center"
                                cellpadding="0"
                                cellspacing="0"
                              >
                                <tr>
                                  <td style="height: 80px">&nbsp;</td>
                                </tr>
                                <tr>
                                  <td style="text-align: center">
                                    <a
                                      href="https://learning.jawwid.com"
                                      title="logo"
                                      target="_blank"
                                    >
                                      <img width="250" src="${img}" title="logo" alt="logo" />
                                    </a>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="height: 20px">&nbsp;</td>
                                </tr>
                                <tr>
                                  <td>
                                    <table
                                      width="95%"
                                      border="0"
                                      align="center"
                                      cellpadding="0"
                                      cellspacing="0"
                                      style="
                                        max-width: 670px;
                                        background: #fff;
                                        border-radius: 3px;
                                        text-align: center;
                                        -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                        -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                        box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                                      "
                                    >
                                      <tr>
                                        <td style="height: 40px">&nbsp;</td>
                                      </tr>
                                      <tr>
                                        <td style="padding: 0 35px">
                                          <span
                                            style="
                                              display: inline-block;
                                              vertical-align: middle;
                                              margin: 29px 0 26px;
                                              border-bottom: 1px solid #cecece;
                                              width: 200px;
                                            "
                                          ></span>
                                          <p
                                            style="
                                              color: #455056;
                                              font-size: 17px;
                                              line-height: 24px;
                                              text-align: left;
                                            "
                                          >
                                            Hello ${capitalizeFirstLetterOfName},
                                          </p>
                                          <p
                                            style="
                                              color: #455056;
                                              font-size: 17px;
                                              line-height: 24px;
                                              text-align: left;
                                            "
                                          >
                                          We hope you are enjoying your time on Jawwid.<br>
                                          <br>
                                          We want to inform you that you have been removed from class: ${classes.name}<br>
                                          <br>
                                          If you have any questions or further information contact the support team.
                                        </p>
                                          
                    
                                          <br>
                                          <p
                                            style="
                                              margin-top: 3px;
                                              color: #455056;
                                              font-size: 17px;
                                              line-height: 2px;
                                              text-align: left;
                                            "
                                          >
                                            The Jawwid Team.
                                          </p>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style="height: 40px">&nbsp;</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                    
                                <tr>
                                  <td style="height: 20px">&nbsp;</td>
                                </tr>
                                <tr>
                                  <td style="text-align: center">
                                    <p
                                      style="
                                        font-size: 14px;
                                        color: rgba(69, 80, 86, 0.7411764705882353);
                                        line-height: 18px;
                                        margin: 0 0 0;
                                      "
                                    >
                                      &copy; <strong>https://learning.jawwid.com</strong>
                                    </p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="height: 80px">&nbsp;</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <!--/100% body table-->
                      </body>
                    </html>`;

        try {
          await sendEmail({
            email: student.email,
            subject: `${capitalizeFirstLetterOfName}, You have been removed from class ${classes.name}`,
            message: emailTamplate,
          });
          console.log("Email sent");
        } catch (error) {
          console.log(error);
        }
      });
    }

    // Update the class document using findOneAndUpdate
    const updatedClass = await classModel.findOneAndUpdate(
      { _id: classId },
      { studentsEnrolled: classes.studentsEnrolled },
      { new: true } // Return the updated document
    );

    // Emit notifications to students
    classNotify(
      studentIds,
      `You have been removed from class: ${classes.name}`,
      classId
    );

    res
      .status(200)
      .json({ message: "Students removed successfully", updatedClass });
  } catch (error) {
    console.error("Error removing students from class:", error);
    next(error);
  }
});

exports.getClassesGroupedByMonthAndStatus = asyncHandler(
  async (req, res, next) => {
    let filter = {};
    const { page, limit, ...query } = req.query;

    // Construct filter based on query parameters
    Object.keys(query).forEach((key) => {
      if (mongoose.Types.ObjectId.isValid(query[key])) {
        filter[key] = mongoose.Types.ObjectId(query[key]);
      } else if (typeof query[key] === "string") {
        filter[key] = { $regex: query[key], $options: "i" };
      } else {
        filter[key] = query[key];
      }
    });

    if (query.month) {
      query.month = parseInt(query.month, 10);
    }

    try {
      console.log("Filter:", filter); // Log filter to check its content

      // Pipeline to aggregate classes grouped by month, year, and status
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            month: {
              $month: {
                $dateFromString: {
                  dateString: "$start_date",
                  format: "%d/%m/%Y",
                },
              },
            },
            year: {
              $year: {
                $dateFromString: {
                  dateString: "$start_date",
                  format: "%d/%m/%Y",
                },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              year: "$year",
              month: "$month",
              status: "$status",
            },
            classes: {
              $push: {
                _id: "$_id",
                name: "$name",
                start_date: "$start_date",
                duration: "$duration",
                start_time: "$start_time",
                zoomMeetingId: "$zoomMeetingId",
                classZoomLink: "$classZoomLink",
                meetingPassword: "$meetingPassword",
                teacher: "$teacher",
                studentsEnrolled: "$studentsEnrolled",
                comment: "$comment",
                attendance: "$attendance",
                assignments: "$assignments",
                createdAt: "$createdAt",
                updatedAt: "$updatedAt",
              },
            },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.status": 1 },
        },
        {
          $group: {
            _id: { year: "$_id.year", month: "$_id.month" },
            classes: {
              $push: {
                year: "$_id.year",
                month: "$_id.month",
                status: "$_id.status",
                classes: "$classes",
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            classes: 1,
          },
        },
      ];

      // Execute aggregation pipeline
      let aggregatedResult = await classModel.aggregate(pipeline);

      // Check if aggregatedResult is empty or undefined
      if (!aggregatedResult || aggregatedResult.length === 0) {
        console.log("No classes found"); // Log message for debugging
        return res.status(404).json({ message: "No classes found" });
      }

      // Flatten and format the response as per the desired structure
      let formattedResponse = [];

      aggregatedResult.forEach((monthGroup) => {
        monthGroup.classes.forEach((statusGroup) => {
          statusGroup.classes.forEach((classItem) => {
            // Find or create a matching entry in formattedResponse
            let existingEntry = formattedResponse.find(
              (entry) =>
                entry.year === monthGroup.year &&
                entry.month === monthGroup.month &&
                entry.status === statusGroup.status
            );

            if (!existingEntry) {
              existingEntry = {
                year: monthGroup.year,
                month: monthGroup.month,
                status: statusGroup.status,
                classes: [],
              };
              formattedResponse.push(existingEntry);
            }

            // Push classItem into the appropriate entry in formattedResponse
            existingEntry.classes.push(classItem);
          });
        });
      });

      // Handle pagination if necessary
      if (limit && page) {
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 5;
        const skipNum = (pageNum - 1) * limitNum;

        const totalPages = Math.ceil(formattedResponse.length / limitNum);
        const paginatedResults = formattedResponse.slice(
          skipNum,
          skipNum + limitNum
        );

        return res.status(200).json({
          totalPages,
          page: pageNum,
          results: paginatedResults.length,
          data: paginatedResults,
        });
      } else {
        // Return the formatted response without pagination
        return res
          .status(200)
          .json({ results: formattedResponse.length, data: formattedResponse });
      }
    } catch (error) {
      console.error("Error in getClassesGroupedByMonthAndStatus:", error); // Log detailed error message
      next(error);
    }
  }
);

exports.classCheckIn = asyncHandler(async (req, res, next) => {
  const { classId } = req.params;

  const cls = await classModel
    .findById(classId)
    .populate("teacher", "_id name email phone timezone");

  if (!cls) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  if (cls.teacher._id.toString() !== req.user._id.toString()) {
    return next(new ApiError(`you are not the teacher of this class`, 404));
  }

  if (cls.status !== "scheduled") {
    return next(
      new ApiError(`check in only available for scheduled classes`, 400)
    );
  }

  const checkInExists = await checkInOutModel.findOne({ class: classId });

  if (checkInExists) {
    return next(new ApiError(`there is already a check in record for this class`, 500));
  }

  try {
    const checkIn = await checkInOutModel.create({
      class: `${cls._id}`,
      teacher: req.user._id,
      checkIn: new Date(
        moment().tz(cls.teacher.timezone).format("YYYY-MM-DDTHH:mm:ss[Z]")
      ),
    });

    res.status(200).json(checkIn);
  } catch (error) {
    console.error("Error adding check in record:", error);
    next(error);
  }
});

exports.classCheckOut = asyncHandler(async (req, res, next) => {
  const { classId } = req.params;

  const cls = await classModel
    .findById(classId)
    .populate("teacher", "_id name email phone timezone");

  if (!cls) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  if (cls.teacher._id.toString() !== req.user._id.toString()) {
    return next(new ApiError(`you are not the teacher of this class`, 404));
  }

  const checkInExists = await checkInOutModel.findOne({ class: classId });

  if (!checkInExists && !checkInExists.checkIn) {
    return next(
      new ApiError(
        `Can't set the check out record untill you check in first`,
        500
      )
    );
  }

  if (checkInExists && checkInExists.checkOut) {
    return next(
      new ApiError(`there is a check out record for this class`, 404)
    );
  }

  try {
    const checkout = await checkInOutModel.findOneAndUpdate(
      { class: classId },
      {
        checkOut: new Date(
          moment().tz(cls.teacher.timezone).format("YYYY-MM-DDTHH:mm:ss[Z]")
        ),
      },
      { new: true }
    );

    const ckin= moment(checkout.checkIn)
    const ckOut= moment(checkout.checkOut)
    const duration = moment.duration(ckOut.diff(ckin));
    const hours = duration.hours()
    const minutes = duration.minutes()
    const seconds = duration.seconds()

    checkout.duration = `${hours} hours ${minutes} minutes ${seconds} seconds`
    await checkout.save()

    res.status(200).json(checkout);
  } catch (error) {
    console.error("Error adding check out record:", error);
    next(error);
  }
});

exports.getClassCheckInOut = asyncHandler(async (req, res, next) => {
  const { classId } = req.params;

  const cls = await classModel
    .findById(classId)
    .populate("teacher", "_id name email phone timezone");

  if (!cls) {
    return next(new ApiError(`No class found for this id:${classId}`, 404));
  }

  const classCheckInOut = await checkInOutModel.findOne({class: classId}).populate("class", "_id name start_date start_time meeting_time")

  if (!classCheckInOut) {
    return next(new ApiError(`No check in and out records for this class`, 404));
  }

  res.status(200).json(classCheckInOut)

})
